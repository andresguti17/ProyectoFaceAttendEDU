"""Session + RBAC guard for the biometric routers — REST and WebSocket.

Same contract as the Java ``AuthTokenFilter`` used by the other services: the
Bearer token is an opaque session UUID validated against identity, and the
required permission is evaluated by authorization.

`_validate_session_and_permission` is the one rule both transports use:
`require_permission` wraps it for REST (raises `HTTPException`),
`authenticate_websocket` wraps it for the WS handshake (raises
`WebSocketAuthError`, since a WebSocket connection has no HTTP status line to
carry the rejection).
"""
from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from fastapi import HTTPException, Request, WebSocket, status

from domain.similarity import face_threshold_from_confidence
from infrastructure.config.settings import get_settings

logger = logging.getLogger("biometric.security")

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)
_TIMEOUT_SECONDS = 4.0

# Caché positiva de autenticación (TTL corto). Cada request autenticado
# costaba 1-2 introspecciones secuenciales; bajo fan-out eso saturaba
# identity/authorization y el gateway respondía 503. Solo se cachean
# resultados POSITIVOS: cualquier fallo se revalida en vivo (fail-secure).
# Ventana de revocación/logout: _AUTH_CACHE_TTL_SECONDS.
_AUTH_CACHE_TTL_SECONDS = 10.0
_AUTH_CACHE_MAX_ENTRIES = 5000

# token -> (user_id, expira_en_monotonic)
_session_cache: dict[str, tuple[str, float]] = {}
# (token, user_id, permission) -> expira_en_monotonic (solo permitidos)
_eval_cache: dict[tuple[str, str, str], float] = {}


def _cache_get(mapping: dict, key):
    """Devuelve el valor si no expiró; si no, lo purga y devuelve None."""
    hit = mapping.get(key)
    if hit is None:
        return None
    value, exp = hit
    if exp <= time.monotonic():
        mapping.pop(key, None)
        return None
    return value


def _cache_store(mapping: dict, key, value) -> None:
    if len(mapping) > _AUTH_CACHE_MAX_ENTRIES:
        mapping.clear()
    mapping[key] = (value, time.monotonic() + _AUTH_CACHE_TTL_SECONDS)

# WS close codes in the private-use range (RFC 6455 §7.4.2), mirroring the
# REST status they replace — a WebSocket handshake has no status line.
WS_CLOSE_UNAUTHORIZED = 4401
WS_CLOSE_FORBIDDEN = 4403
WS_CLOSE_SERVICE_UNAVAILABLE = 4503

_WS_CLOSE_BY_STATUS = {
    status.HTTP_401_UNAUTHORIZED: WS_CLOSE_UNAUTHORIZED,
    status.HTTP_403_FORBIDDEN: WS_CLOSE_FORBIDDEN,
    status.HTTP_503_SERVICE_UNAVAILABLE: WS_CLOSE_SERVICE_UNAVAILABLE,
}


class _AuthError(Exception):
    """Internal: carries the HTTP-shaped status the caller maps to its transport."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class WebSocketAuthError(Exception):
    """Raised by `authenticate_websocket`; `code`/`reason` go straight to `websocket.close`."""

    def __init__(self, code: int, reason: str) -> None:
        self.code = code
        self.reason = reason
        super().__init__(reason)


async def _get_json(url: str, token: str) -> tuple[int, dict | None]:
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
    body = response.json() if response.status_code == 200 else None
    return response.status_code, body if isinstance(body, dict) else None


async def _get_list(url: str, token: str) -> list:
    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
    body = response.json() if response.status_code == 200 else None
    return body if isinstance(body, list) else []


def _bearer(request: Request) -> str:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = header[7:].strip()
    if not _UUID_RE.match(token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token format")
    return token


WS_BEARER_PROTOCOL = "faceattend.bearer"


def _offered_ws_protocols(websocket: WebSocket) -> list[str]:
    raw = websocket.headers.get("sec-websocket-protocol", "")
    return [p.strip() for p in raw.split(",") if p.strip()]


def ws_bearer_subprotocol(websocket: WebSocket) -> str | None:
    """The subprotocol to echo on accept: browsers drop the connection unless the
    server picks one of the protocols they offered."""
    return WS_BEARER_PROTOCOL if WS_BEARER_PROTOCOL in _offered_ws_protocols(websocket) else None


def extract_ws_token(websocket: WebSocket) -> str | None:
    """Browsers cannot set custom headers on a WS handshake, so the token travels as
    the value after `faceattend.bearer` in Sec-WebSocket-Protocol — never in the URL,
    where proxies and access logs would keep it. Non-browser clients may send a
    Bearer header instead."""
    offered = _offered_ws_protocols(websocket)
    if len(offered) == 2 and offered[0] == WS_BEARER_PROTOCOL:
        return offered[1]
    header = websocket.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return None


async def _validate_session_and_permission(token: str, permission: str | None) -> str:
    """Shared rule: active session, then (when given) the required permission.

    Returns the authenticated user id. Raises `_AuthError` on any failure.
    """
    if not _UUID_RE.match(token):
        raise _AuthError(status.HTTP_401_UNAUTHORIZED, "Invalid token format")

    settings = get_settings()
    cached_user = _cache_get(_session_cache, token)
    if cached_user is not None:
        user_id = cached_user
    else:
        try:
            code, session = await _get_json(
                f"{settings.identity_url}/api/v1/sessions/{token}", token
            )
        except httpx.HTTPError:
            logger.warning("identity unreachable while validating a session")
            raise _AuthError(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot verify session")
        if code != 200 or not session or session.get("sessionStatus") != "Active" or not session.get("userId"):
            raise _AuthError(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")

        user_id = str(session["userId"])
        _cache_store(_session_cache, token, user_id)

    if permission is None:
        return user_id

    eval_key = (token, user_id, permission)
    if _cache_get(_eval_cache, eval_key) is True:
        return user_id

    url = (
        f"{settings.authorization_url}/api/v1/auth/evaluate"
        f"?userId={quote(user_id)}&permission={quote(permission)}"
    )
    try:
        code, result = await _get_json(url, token)
    except httpx.HTTPError:
        logger.warning("authorization unreachable while evaluating %s", permission)
        raise _AuthError(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot verify permissions")
    if code != 200 or not result or result.get("allowed") is not True:
        raise _AuthError(status.HTTP_403_FORBIDDEN, f"Forbidden: requires {permission}")
    _cache_store(_eval_cache, eval_key, True)
    return user_id


def require_permission(permission: str | None):
    """Build a REST dependency that needs an active session and, when given, a permission."""

    async def dependency(request: Request) -> None:
        settings = get_settings()
        if not settings.auth_enabled:
            return
        token = _bearer(request)
        try:
            request.state.user_id = await _validate_session_and_permission(token, permission)
        except _AuthError as exc:
            raise HTTPException(exc.status_code, exc.detail) from exc

    return dependency


# ── Caller/person school scope (update-request endpoints) ──────────────────
#
# `biometric.case:request` is held by every role (SEEDS.md) and
# `biometric.case:review` by Administrador/Instructor/Super Administrador —
# neither permission alone says WHICH person/school the caller may touch.
# Resolved the same way as the Java/TS CallerSchoolResolvers: Super
# Administrador is unrestricted; everyone else is confined to their own
# school, via their own academic_actor — never trusted from the request.

SUPER_ADMIN_ROLE = "Super Administrador"
_SCHOOL_CACHE_TTL_SECONDS = 30.0
# user_id -> ((is_super_admin, school_id), expira_en_monotonic)
_caller_school_cache: dict[str, tuple[tuple[bool, str | None], float]] = {}


async def _resolve_roles(user_id: str, token: str) -> list[str]:
    settings = get_settings()
    try:
        role_dicts = await _get_list(
            f"{settings.authorization_url}/api/v1/users/{quote(user_id)}/roles", token
        )
    except httpx.HTTPError:
        logger.warning("authorization unreachable while resolving roles")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot verify roles")
    return [str(r["roleName"]) for r in role_dicts if isinstance(r, dict) and r.get("roleName")]


async def resolve_person_school(person_id: str, token: str) -> str | None:
    """The school of `person_id`, via their academic_actor — None with no actor."""
    settings = get_settings()
    try:
        actors = await _get_list(
            f"{settings.academic_url}/api/v1/academic-actors?personId={quote(person_id)}", token
        )
    except httpx.HTTPError:
        logger.warning("academic unreachable while resolving a person's school")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot resolve the person's school")
    for actor in actors:
        if isinstance(actor, dict) and actor.get("schoolId") is not None:
            return str(actor["schoolId"])
    return None


async def resolve_caller_school(user_id: str, token: str) -> tuple[bool, str | None]:
    """(is_super_admin, school_id) for `user_id` — fails secure to (False, None)
    for a caller without an academic_actor, never "sees everything"."""
    cached = _cache_get(_caller_school_cache, user_id)
    if cached is not None:
        return cached

    roles = await _resolve_roles(user_id, token)
    if SUPER_ADMIN_ROLE in roles:
        result: tuple[bool, str | None] = (True, None)
        _cache_store(_caller_school_cache, user_id, result)
        return result

    settings = get_settings()
    try:
        code, user = await _get_json(f"{settings.identity_url}/api/v1/users/{quote(user_id)}", token)
    except httpx.HTTPError:
        logger.warning("identity unreachable while resolving the caller's person")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot resolve the user person")
    person_id = str(user["personId"]) if code == 200 and user and user.get("personId") else None
    school_id = await resolve_person_school(person_id, token) if person_id else None
    result = (False, school_id)
    _cache_store(_caller_school_cache, user_id, result)
    return result


# ── Per-school face confidence ─────────────────────────────────────────────
#
# Settings > Reconocimiento stores the school's confidence as the academic
# configuration `web.facial_confidence` (ms-configuration). Recognition reads it
# with the caller's own session; any failure falls back to the service default,
# so a configuration outage never blocks taking attendance.

_FACE_CONFIDENCE_KEY = "web.facial_confidence"
_SCHOOL_CONFIDENCE_TTL_SECONDS = 30.0
# school_id -> (confidence percent or None, expira_en_monotonic)
_school_confidence_cache: dict[str, tuple[float | None, float]] = {}


async def _school_face_confidence(school_id: str, token: str) -> float | None:
    hit = _school_confidence_cache.get(school_id)
    if hit is not None and hit[1] > time.monotonic():
        return hit[0]
    settings = get_settings()
    value: float | None = None
    try:
        rows = await _get_list(
            f"{settings.configuration_url}/api/v1/schools/{quote(school_id)}/configurations", token
        )
        for row in rows:
            if isinstance(row, dict) and row.get("configurationName") == _FACE_CONFIDENCE_KEY:
                value = float(row.get("configurationValue"))
    except (httpx.HTTPError, ValueError, TypeError):
        logger.warning("cannot read the school face confidence; using the default")
        value = None
    if len(_school_confidence_cache) > _AUTH_CACHE_MAX_ENTRIES:
        _school_confidence_cache.clear()
    _school_confidence_cache[school_id] = (value, time.monotonic() + _SCHOOL_CONFIDENCE_TTL_SECONDS)
    return value


async def face_threshold_for_caller(user_id: str | None, token: str | None, default: float) -> float:
    """Face score threshold for the caller's school; `default` when it has none."""
    if not user_id or not token:
        return default
    try:
        is_super_admin, school_id = await resolve_caller_school(user_id, token)
    except HTTPException:
        return default
    if is_super_admin or school_id is None:
        return default
    percent = await _school_face_confidence(school_id, token)
    return default if percent is None else face_threshold_from_confidence(percent)


async def ensure_can_touch_person(request: Request, person_id: str) -> None:
    """Who may request/list biometric update cases FOR `person_id`.

    Anyone may always touch their own. A reviewer (Administrador/Instructor/
    Super Administrador) may also touch anyone in their own school — never
    another school's. A plain requester (Aprendiz) without the review
    permission may only ever touch themselves.
    """
    settings = get_settings()
    if not settings.auth_enabled:
        return
    token = _bearer(request)
    user_id = str(getattr(request.state, "user_id", "") or "")

    try:
        code, user = await _get_json(f"{settings.identity_url}/api/v1/users/{quote(user_id)}", token)
    except httpx.HTTPError:
        logger.warning("identity unreachable while checking person scope")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot verify the caller")
    own_person_id = str(user["personId"]) if code == 200 and user and user.get("personId") else None
    if own_person_id is not None and own_person_id == person_id:
        return

    is_super_admin, caller_school = await resolve_caller_school(user_id, token)
    if is_super_admin:
        return
    if caller_school is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only request an update for your own biometric data")

    code, result = await _get_json(
        f"{settings.authorization_url}/api/v1/auth/evaluate"
        f"?userId={quote(user_id)}&permission={quote('biometric.case:review')}",
        token,
    )
    is_reviewer = code == 200 and bool(result) and result.get("allowed") is True
    if not is_reviewer:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only request an update for your own biometric data")

    target_school = await resolve_person_school(person_id, token)
    if target_school != caller_school:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only manage biometric data within your own school")


async def ensure_can_touch_case_person(request: Request, case_person_id: str) -> None:
    """Who may review/delete a biometric update case belonging to `case_person_id`.

    Reached only by a `biometric.case:review` holder already (route dependency),
    so this only narrows Administrador/Instructor to their own school; Super
    Administrador is unrestricted.
    """
    settings = get_settings()
    if not settings.auth_enabled:
        return
    token = _bearer(request)
    user_id = str(getattr(request.state, "user_id", "") or "")

    is_super_admin, caller_school = await resolve_caller_school(user_id, token)
    if is_super_admin:
        return
    if caller_school is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only manage biometric data within your own school")

    target_school = await resolve_person_school(case_person_id, token)
    if target_school != caller_school:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only manage biometric data within your own school")


STAFF_PERMISSION = "attendance.record:write"
CASE_APPROVED = "Approved"


def _as_utc(moment: datetime) -> datetime:
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _approved_after(case: object, enrolled_at: datetime | None) -> bool:
    if not isinstance(case, dict):
        return False
    # configuration answers camelCase `updateStatus`; older mirrors used `status`.
    if (case.get("updateStatus") or case.get("update_status") or case.get("status")) != CASE_APPROVED:
        return False
    if enrolled_at is None:
        return True
    reviewed = case.get("reviewedAt") or case.get("reviewed_at")
    try:
        return _as_utc(datetime.fromisoformat(str(reviewed).replace("Z", "+00:00"))) > _as_utc(enrolled_at)
    except ValueError:
        return False


async def ensure_can_enroll(request: Request, person_id: str, enrolled_at: datetime | None, has_template: bool) -> None:
    """Who may store a facial template for `person_id`.

    Staff (attendance.record:write) enrolls anyone. Everyone else only their own
    person: the first registration is free, and replacing an existing template
    needs a biometric update case approved after that template (RN-29), so each
    approval is good for one re-enrollment.
    """
    settings = get_settings()
    if not settings.auth_enabled:
        return
    token = _bearer(request)
    user_id = str(getattr(request.state, "user_id", "") or "")
    try:
        code, result = await _get_json(
            f"{settings.authorization_url}/api/v1/auth/evaluate"
            f"?userId={quote(user_id)}&permission={quote(STAFF_PERMISSION)}",
            token,
        )
        if code == 200 and result and result.get("allowed") is True:
            return
        code, user = await _get_json(f"{settings.identity_url}/api/v1/users/{quote(user_id)}", token)
        if code != 200 or not user or str(user.get("personId")) != person_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only enroll your own face")
        if not has_template:
            return
        cases = await _get_list(
            f"{settings.configuration_url}/api/v1/persons/{quote(person_id)}/biometric-cases", token
        )
    except httpx.HTTPError:
        logger.warning("identity/authorization/configuration unreachable while checking enrollment")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot verify enrollment rights")
    if any(_approved_after(case, enrolled_at) for case in cases):
        return
    raise HTTPException(
        status.HTTP_403_FORBIDDEN,
        "Replacing a registered face requires an approved biometric update case (RN-29)",
    )


BIOMETRIC_CONSENT_REQUIRED = "BIOMETRIC_CONSENT_REQUIRED"


def bearer_or_none(request: Request | None) -> str | None:
    if request is None:
        return None
    header = request.headers.get("authorization", "")
    return header[7:].strip() if header.lower().startswith("bearer ") else None


async def ensure_biometric_consent(person_id: str, token: str | None) -> None:
    """Ley 1581 (arts. 6-a and 9): no biometric data is stored without the holder's
    prior, express authorization. Read from identity with the caller's session;
    fails closed (503) when identity cannot answer."""
    settings = get_settings()
    if not settings.consent_check_enabled:
        return
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        code, body = await _get_json(f"{settings.identity_url}/api/v1/persons/{quote(person_id)}/consent", token)
    except httpx.HTTPError:
        logger.warning("identity unreachable while checking the biometric authorization")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot verify the biometric data authorization")
    if code == 200 and body and body.get("biometricAuthorized") is True:
        return
    if code in (200, 404):
        raise HTTPException(
            status.HTTP_428_PRECONDITION_REQUIRED,
            detail={
                "code": BIOMETRIC_CONSENT_REQUIRED,
                "message": "The holder has not authorized the processing of biometric data",
            },
        )
    if code == 403:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Person outside your scope")
    if code == 400:
        # identity rejected the id itself: a client error, not an outage (nothing is stored either way)
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "person_id is not a valid person")
    raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Cannot verify the biometric data authorization")


async def authenticate_websocket(websocket: WebSocket, permission: str | None) -> str | None:
    """Same rule as `require_permission`, for a WS handshake.

    Returns the authenticated user id, or `None` when auth is disabled. The
    caller must `websocket.accept()` before this is invoked, so a rejection
    can carry a close code and reason; this never raises `HTTPException`,
    there is no HTTP response left to attach one to.
    """
    settings = get_settings()
    if not settings.auth_enabled:
        return None
    token = extract_ws_token(websocket)
    if not token:
        raise WebSocketAuthError(WS_CLOSE_UNAUTHORIZED, "Missing bearer token")
    try:
        return await _validate_session_and_permission(token, permission)
    except _AuthError as exc:
        code = _WS_CLOSE_BY_STATUS.get(exc.status_code, WS_CLOSE_UNAUTHORIZED)
        raise WebSocketAuthError(code, exc.detail) from exc
