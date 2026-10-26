"""FastAPI dependency wiring (composition root for the driven side).

Every router receives its repositories through `Depends`, so a test can replace
any of them with `app.dependency_overrides[...]` — no production singleton and
no in-memory fallback lives in this module.
"""
from __future__ import annotations

from fastapi import Depends, HTTPException, Request, WebSocket, status

from domain.ports.out.biometric_repository import BiometricRepositoryPort
from domain.ports.out.match_log_repository import MatchLogRepositoryPort
from domain.ports.out.update_case_repository import UpdateCaseRepositoryPort
from domain.value_objects.biometric_type import BiometricType
from infrastructure.config.settings import Settings, get_settings
from infrastructure.persistence.errors import PersistenceUnavailableError
from infrastructure.persistence.mongo_client import MongoClient
from infrastructure.persistence.mongo_embedding_repository import MongoEmbeddingRepository
from infrastructure.persistence.mongo_match_log_repository import MongoMatchLogRepository
from infrastructure.persistence.mongo_update_case_repository import MongoUpdateCaseRepository
from infrastructure.security.rate_limit import RateLimiter
from infrastructure.web.security import face_threshold_for_caller


def get_mongo_client(request: Request) -> MongoClient:
    """The process-wide client published by `main.py`'s lifespan."""
    client = getattr(request.app.state, "mongo_client", None)
    if client is None:
        raise PersistenceUnavailableError(
            "MongoDB client was never initialised; the service did not start correctly"
        )
    return client


def get_facial_repository(
    client: MongoClient = Depends(get_mongo_client),
    settings: Settings = Depends(get_settings),
) -> BiometricRepositoryPort:
    return MongoEmbeddingRepository(client, settings, BiometricType.FACIAL)


def get_fingerprint_repository(
    client: MongoClient = Depends(get_mongo_client),
    settings: Settings = Depends(get_settings),
) -> BiometricRepositoryPort:
    return MongoEmbeddingRepository(client, settings, BiometricType.FINGERPRINT)


def get_update_case_repository(
    client: MongoClient = Depends(get_mongo_client),
    settings: Settings = Depends(get_settings),
) -> UpdateCaseRepositoryPort:
    return MongoUpdateCaseRepository(client, settings)


def get_match_log_repository(
    client: MongoClient = Depends(get_mongo_client),
    settings: Settings = Depends(get_settings),
) -> MatchLogRepositoryPort:
    return MongoMatchLogRepository(client, settings)


def get_similarity_threshold(settings: Settings = Depends(get_settings)) -> float:
    """Cosine score at or above which a comparison counts as a match."""
    return settings.similarity_threshold


async def get_face_match_threshold(request: Request, settings: Settings = Depends(get_settings)) -> float:
    """Face score (`1 - Euclidean distance`) at or above which two faces match.

    The school's own confidence (Settings > Reconocimiento) when the caller has
    one; the service default otherwise.
    """
    default = 1.0 - settings.face_match_max_distance
    header = request.headers.get("authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else None
    return await face_threshold_for_caller(getattr(request.state, "user_id", None), token, default)


def get_fingerprint_match_threshold(settings: Settings = Depends(get_settings)) -> int:
    """Keypoint-match count at or above which two fingerprint samples match."""
    return settings.fingerprint_match_threshold


def get_liveness_secret(settings: Settings = Depends(get_settings)) -> str:
    return settings.liveness_secret_or_ephemeral


# One limiter instance per logical bucket, shared across requests for the life
# of the process (same single-process posture as the source service's limiter).
_rate_limiters: dict[str, RateLimiter] = {}


# ── WebSocket variants ──────────────────────────────────────────────────
# A websocket connection is not a `Request`, so the dependencies above cannot
# be reused as-is: FastAPI resolves a `Request`-typed sub-dependency only for
# HTTP routes. These mirror them 1:1 off `WebSocket` instead, so the WS router
# can be tested the same way (`app.dependency_overrides[...]`).


def get_mongo_client_ws(websocket: WebSocket) -> MongoClient:
    client = getattr(websocket.app.state, "mongo_client", None)
    if client is None:
        raise PersistenceUnavailableError(
            "MongoDB client was never initialised; the service did not start correctly"
        )
    return client


def get_facial_repository_ws(
    client: MongoClient = Depends(get_mongo_client_ws),
    settings: Settings = Depends(get_settings),
) -> BiometricRepositoryPort:
    return MongoEmbeddingRepository(client, settings, BiometricType.FACIAL)


def get_fingerprint_repository_ws(
    client: MongoClient = Depends(get_mongo_client_ws),
    settings: Settings = Depends(get_settings),
) -> BiometricRepositoryPort:
    return MongoEmbeddingRepository(client, settings, BiometricType.FINGERPRINT)


def get_match_log_repository_ws(
    client: MongoClient = Depends(get_mongo_client_ws),
    settings: Settings = Depends(get_settings),
) -> MatchLogRepositoryPort:
    return MongoMatchLogRepository(client, settings)


def _rate_limit_caller(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return f"ip:{real_ip}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


def rate_limit(key: str):
    """Build a 429 dependency for `key`, bucketed per logical endpoint + caller.

    The caller is the authenticated user (set by `require_permission`, which runs
    first in each route's dependency list), else the client address Kong forwards
    in X-Real-IP. Behind the gateway `request.client` is always Kong, so keying on
    it made every user share one bucket and let one account starve the rest.
    """

    def dependency(request: Request, settings: Settings = Depends(get_settings)) -> None:
        limiter = _rate_limiters.get(key)
        if limiter is None or (
            limiter.max_attempts != settings.rate_limit_max_attempts
            or limiter.window_seconds != settings.rate_limit_window_seconds
        ):
            limiter = RateLimiter(settings.rate_limit_max_attempts, settings.rate_limit_window_seconds)
            _rate_limiters[key] = limiter
        allowed, _ = limiter.check(f"{key}:{_rate_limit_caller(request)}")
        if not allowed:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts, slow down")

    return dependency
