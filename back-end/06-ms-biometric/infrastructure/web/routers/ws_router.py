"""Biometric WebSocket channel — REST/WS coexistence (primary adapter).

One persistent connection per client (kiosk, device, dashboard) replaces the
request/response cycle of `facial_router.py` / `fingerprint_router.py` for
clients that migrate: it can send many `enroll` / `verify` / `identify`
messages over the same socket, and it receives a real-time
`attendance.event` notification whenever *any* connected client registers a
person (who, which modality, what kind of event, when) — not just the one
that sent the request.

REST is untouched, and there is no second copy of the matching rules: every
message is handled by calling the *exact same* REST route-handler coroutines
(`facial_router.enroll_facial`, `.verify_facial`, `.identify_facial` and their
fingerprint counterparts) with manually supplied dependencies, instead of
duplicating their bodies. A FastAPI path function is a plain `async def`;
nothing stops this module from importing and awaiting it directly. Payloads
are validated with the exact same pydantic request models those routers use.

Wire protocol
-------------
Client -> server, one JSON object per text frame::

    {"type": "facial.identify", "client_message_id": "c1", "payload": {"encoding": [...]}}

`type` is one of ``facial.enroll`` / ``facial.verify`` / ``facial.identify`` /
``facial.identify_image`` / ``fingerprint.enroll`` / ``fingerprint.verify`` /
``fingerprint.identify`` / ``fingerprint.identify_sample`` / ``ping``. `payload` is validated with the same pydantic model the matching
REST endpoint uses. `client_message_id` is optional but required for the
idempotent-replay guarantee below. `direction` (`CHECK_IN` default or
`CHECK_OUT`) tags an `identify` as an entry or exit for the broadcast event.

Server -> client:

* ``<type>.ack`` — the result of the client's own message (same shape REST
  would have returned, plus `client_message_id`/`timestamp`).
* ``error`` — the message was invalid or the operation failed (e.g. no match);
  the connection stays open.
* ``pong`` — reply to a client ``ping``.
* ``attendance.event`` — pushed to every *other* connected client when an
  enroll or a successful identify happens anywhere on this channel: who
  (`person_id`), which modality, what kind of event (`CHECK_IN` / `CHECK_OUT`
  / `FACIAL_ENROLLED` / `FINGERPRINT_ENROLLED`) and `timestamp`.

Reliability
-----------
* **Auth**: same session + RBAC rule as REST (`infrastructure.web.security`),
  since a WS handshake has no Authorization-header support in browsers the
  session token travels as `?token=`.
* **Heartbeat**: the client is expected to send `{"type": "ping"}`
  periodically; the server replies `pong` and, independently, closes any
  connection that has sent nothing at all for `settings.ws_idle_timeout_seconds`
  — that bounds how long a half-open socket holds a slot after the peer
  vanishes without a close frame.
* **No lost/duplicated registration**: every ack and every error is cached by
  `client_message_id` (`IdempotencyCache`). If the connection drops after the
  server processed a message but before the ack arrived, the client
  reconnects and resends the same `client_message_id`; the cached response is
  replayed instead of enrolling/matching a second time.

Scope: the vector `encoding: list[float]` enroll/verify/identify (what
attendance capture actually sends), `facial.identify_image` (an image
identify that consumes a completed liveness token) and
`fingerprint.identify_sample` (a raw-sample identify, the attendance
counterpart of `/identify-sample`) are exposed here. The remaining
image/sample/liveness endpoints merged in from `10-ms-face-auth`
(`/enroll-image`, `/enroll-sample`, `/liveness-*`) stay REST-only — they are a
multi-step enrollment UI flow, not a single request/response attendance event.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, ValidationError

from domain.ports.out.biometric_repository import BiometricRepositoryPort
from domain.ports.out.match_log_repository import MatchLogRepositoryPort
from infrastructure.config.dependencies import (
    get_facial_repository_ws,
    get_fingerprint_match_threshold,
    get_fingerprint_repository_ws,
    get_liveness_secret,
    get_match_log_repository_ws,
    get_similarity_threshold,
)
from infrastructure.config.settings import Settings, get_settings
from infrastructure.web.routers.facial_router import (
    EnrollFacialRequest,
    IdentifyFacialImageRequest,
    IdentifyFacialRequest,
    VerifyFacialRequest,
    enroll_facial,
    identify_facial,
    identify_facial_image,
    verify_facial,
)
from infrastructure.web.routers.fingerprint_router import (
    EnrollFingerprintRequest,
    IdentifyFingerprintRequest,
    IdentifyFingerprintSampleRequest,
    VerifyFingerprintRequest,
    enroll_fingerprint,
    identify_fingerprint,
    identify_fingerprint_sample,
    verify_fingerprint,
)
from infrastructure.web.security import WebSocketAuthError, authenticate_websocket
from infrastructure.web.ws.connection_manager import ConnectionManager
from infrastructure.web.ws.idempotency import IdempotencyCache

router = APIRouter(prefix="/api/v1/biometric", tags=["biometric-ws"])
logger = logging.getLogger("biometric.ws")

# Same permission REST requires to capture attendance.
PERMISSION = "attendance.record:write"

FACIAL_ENROLL = "facial.enroll"
FACIAL_VERIFY = "facial.verify"
FACIAL_IDENTIFY = "facial.identify"
FACIAL_IDENTIFY_IMAGE = "facial.identify_image"
FINGERPRINT_ENROLL = "fingerprint.enroll"
FINGERPRINT_VERIFY = "fingerprint.verify"
FINGERPRINT_IDENTIFY = "fingerprint.identify"
FINGERPRINT_IDENTIFY_SAMPLE = "fingerprint.identify_sample"
PING = "ping"

_PAYLOAD_MODELS: dict[str, type[BaseModel]] = {
    FACIAL_ENROLL: EnrollFacialRequest,
    FACIAL_VERIFY: VerifyFacialRequest,
    FACIAL_IDENTIFY: IdentifyFacialRequest,
    FACIAL_IDENTIFY_IMAGE: IdentifyFacialImageRequest,
    FINGERPRINT_ENROLL: EnrollFingerprintRequest,
    FINGERPRINT_VERIFY: VerifyFingerprintRequest,
    FINGERPRINT_IDENTIFY: IdentifyFingerprintRequest,
    FINGERPRINT_IDENTIFY_SAMPLE: IdentifyFingerprintSampleRequest,
}


class _CorrelatedRequest:
    """Duck-typed stand-in for `Request`: the handlers below only ever read
    `request.state.correlation_id` (see `_correlation_id` in each router)."""

    class _State:
        def __init__(self, correlation_id: str) -> None:
            self.correlation_id = correlation_id

    def __init__(self, correlation_id: str) -> None:
        self.state = self._State(correlation_id)


class WsEnvelope(BaseModel):
    type: str
    client_message_id: str | None = Field(default=None, min_length=1)
    direction: Literal["CHECK_IN", "CHECK_OUT"] = "CHECK_IN"
    payload: dict[str, Any] = Field(default_factory=dict)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _error_frame(client_message_id: str | None, code: str, message: str) -> dict[str, Any]:
    return {
        "type": "error",
        "client_message_id": client_message_id,
        "error": code,
        "message": message,
        "timestamp": _now_iso(),
    }


def _ack_frame(message_type: str, client_message_id: str | None, result: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": f"{message_type}.ack",
        "client_message_id": client_message_id,
        "result": result,
        "timestamp": _now_iso(),
    }


def _error_code_for_status(status_code: int) -> str:
    if status_code == 404:
        return "NotFound"
    if status_code == 409:
        return "Conflict"
    if status_code == 429:
        return "TooManyRequests"
    if status_code < 500:
        return "BadRequest"
    return "InternalError"


async def _dispatch(
    message_type: str,
    raw_payload: dict[str, Any],
    *,
    direction: str,
    facial_repo: BiometricRepositoryPort,
    fingerprint_repo: BiometricRepositoryPort,
    match_logs: MatchLogRepositoryPort,
    threshold: float,
    fp_threshold: int,
    secret: str,
    settings: Settings,
    correlation_id: str,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Validate `raw_payload` and call the matching REST route handler directly.

    Returns `(result, event)`: `result` goes in the ack to the sender, `event`
    (or `None` for a plain verify) is broadcast to every other connection.
    May raise `HTTPException` — same as the REST endpoint would return.
    """
    data = _PAYLOAD_MODELS[message_type].model_validate(raw_payload)
    fake_request = _CorrelatedRequest(correlation_id)
    is_fingerprint = message_type.startswith("fingerprint.")

    if message_type in (FACIAL_ENROLL, FINGERPRINT_ENROLL):
        template = (
            await enroll_fingerprint(data, fingerprint_repo)
            if is_fingerprint
            else await enroll_facial(data, facial_repo)
        )
        event = {
            "event_type": "FINGERPRINT_ENROLLED" if is_fingerprint else "FACIAL_ENROLLED",
            "person_id": data.person_id,
            "biometric_type": "FINGERPRINT" if is_fingerprint else "FACIAL",
            "finger_number": getattr(data, "finger_number", None),
            "timestamp": _now_iso(),
            "correlation_id": correlation_id,
        }
        return template, event

    if message_type in (FACIAL_VERIFY, FINGERPRINT_VERIFY):
        result = (
            await verify_fingerprint(data, fake_request, fingerprint_repo, match_logs, threshold)
            if is_fingerprint
            else await verify_facial(data, fake_request, facial_repo, match_logs, threshold)
        )
        return result, None

    if message_type == FACIAL_IDENTIFY_IMAGE:
        result = await identify_facial_image(
            data, fake_request, facial_repo, match_logs, threshold, secret, settings
        )
        event = {
            "event_type": direction,
            "person_id": result["person_id"],
            "biometric_type": "FACIAL",
            "finger_number": None,
            "score": result["score"],
            "timestamp": _now_iso(),
            "correlation_id": correlation_id,
        }
        return result, event

    if message_type == FINGERPRINT_IDENTIFY_SAMPLE:
        result = await identify_fingerprint_sample(
            data, fake_request, fingerprint_repo, match_logs, fp_threshold, settings
        )
        event = {
            "event_type": direction,
            "person_id": result["person_id"],
            "biometric_type": "FINGERPRINT",
            "finger_number": result.get("finger_number"),
            "score": result["score"],
            "timestamp": _now_iso(),
            "correlation_id": correlation_id,
        }
        return result, event

    # facial.identify / fingerprint.identify
    result = (
        await identify_fingerprint(data, fake_request, fingerprint_repo, match_logs, threshold)
        if is_fingerprint
        else await identify_facial(data, fake_request, facial_repo, match_logs, threshold)
    )
    event = {
        "event_type": direction,
        "person_id": result["person_id"],
        "biometric_type": "FINGERPRINT" if is_fingerprint else "FACIAL",
        "finger_number": result.get("finger_number"),
        "score": result["score"],
        "timestamp": _now_iso(),
        "correlation_id": correlation_id,
    }
    return result, event


async def _handle_frame(
    websocket: WebSocket,
    raw: str,
    *,
    facial_repo: BiometricRepositoryPort,
    fingerprint_repo: BiometricRepositoryPort,
    match_logs: MatchLogRepositoryPort,
    threshold: float,
    fp_threshold: int,
    idempotency: IdempotencyCache,
    manager: ConnectionManager,
    secret: str,
    settings: Settings,
) -> None:
    try:
        envelope = WsEnvelope.model_validate_json(raw)
    except ValidationError:
        await websocket.send_json(_error_frame(None, "BadRequest", "invalid message envelope"))
        return

    if envelope.type == PING:
        await websocket.send_json(
            {"type": "pong", "client_message_id": envelope.client_message_id, "timestamp": _now_iso()}
        )
        return

    if envelope.type not in _PAYLOAD_MODELS:
        await websocket.send_json(
            _error_frame(envelope.client_message_id, "BadRequest", f"unknown message type: {envelope.type}")
        )
        return

    if envelope.client_message_id:
        cached = idempotency.get(envelope.client_message_id)
        if cached is not None:
            await websocket.send_json(cached)
            return

    try:
        result, event = await _dispatch(
            envelope.type,
            envelope.payload,
            direction=envelope.direction,
            facial_repo=facial_repo,
            fingerprint_repo=fingerprint_repo,
            match_logs=match_logs,
            threshold=threshold,
            fp_threshold=fp_threshold,
            secret=secret,
            settings=settings,
            correlation_id=str(uuid4()),
        )
    except ValidationError:
        await websocket.send_json(_error_frame(envelope.client_message_id, "BadRequest", "invalid payload"))
        return
    except HTTPException as exc:
        response = _error_frame(
            envelope.client_message_id, _error_code_for_status(exc.status_code), str(exc.detail)
        )
        if envelope.client_message_id:
            idempotency.set(envelope.client_message_id, response)
        await websocket.send_json(response)
        return
    except Exception:  # noqa: BLE001 - last-resort guard, see module docstring.
        # Anything else (a dlib RuntimeError, a Mongo connection error, ...)
        # would otherwise propagate out of this coroutine and, per FastAPI's
        # WebSocket handling, drop the connection entirely. The frontend's
        # reconnect-and-resend logic would then reconnect and resend the exact
        # same poison message forever. Degrade to an error frame instead, same
        # as the HTTPException branch above, and keep the connection open.
        logger.exception("unexpected error handling ws frame type=%s", envelope.type)
        response = _error_frame(envelope.client_message_id, "InternalError", "internal error")
        if envelope.client_message_id:
            idempotency.set(envelope.client_message_id, response)
        await websocket.send_json(response)
        return

    response = _ack_frame(envelope.type, envelope.client_message_id, result)
    if envelope.client_message_id:
        idempotency.set(envelope.client_message_id, response)
    await websocket.send_json(response)

    if event is not None:
        await manager.broadcast({"type": "attendance.event", **event}, exclude=websocket)


@router.websocket("/ws")
async def biometric_ws(
    websocket: WebSocket,
    facial_repo: BiometricRepositoryPort = Depends(get_facial_repository_ws),
    fingerprint_repo: BiometricRepositoryPort = Depends(get_fingerprint_repository_ws),
    match_logs: MatchLogRepositoryPort = Depends(get_match_log_repository_ws),
    threshold: float = Depends(get_similarity_threshold),
    fp_threshold: int = Depends(get_fingerprint_match_threshold),
    secret: str = Depends(get_liveness_secret),
    settings: Settings = Depends(get_settings),
) -> None:
    await websocket.accept()
    try:
        user_id = await authenticate_websocket(websocket, PERMISSION)
    except WebSocketAuthError as exc:
        await websocket.close(code=exc.code, reason=exc.reason)
        return

    manager: ConnectionManager = websocket.app.state.ws_connection_manager
    idempotency: IdempotencyCache = websocket.app.state.ws_idempotency_cache
    await manager.connect(websocket)
    logger.info(
        "biometric ws connected user=%s connections=%s", user_id, manager.connection_count()
    )

    try:
        while True:
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(), timeout=settings.ws_idle_timeout_seconds
                )
            except asyncio.TimeoutError:
                await websocket.close(code=1001, reason="idle timeout")
                break

            await _handle_frame(
                websocket,
                raw,
                facial_repo=facial_repo,
                fingerprint_repo=fingerprint_repo,
                match_logs=match_logs,
                threshold=threshold,
                fp_threshold=fp_threshold,
                idempotency=idempotency,
                manager=manager,
                secret=secret,
                settings=settings,
            )
    except WebSocketDisconnect:
        logger.info("biometric ws disconnected user=%s", user_id)
    finally:
        await manager.disconnect(websocket)
