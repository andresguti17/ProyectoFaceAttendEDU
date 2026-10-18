"""Typed configuration read from the environment (pydantic-settings).

Environment contract:

* ``MONGODB_URL`` — set by `back-end/docker-compose.yml` for `ms-biometric`
  (also accepted as ``BIOMETRIC_MONGODB_URL``).
* Everything else is optional and takes the ``BIOMETRIC_`` prefix, e.g.
  ``BIOMETRIC_FACIAL_COLLECTION``.

Collection names default to the canonical document model in
fae-docs/06-data/domains/06-biometric.md (``facial_embeddings``,
``fingerprint_embeddings``), which DATA_MODEL.md names as the authoritative
source for this service.
"""
from __future__ import annotations

import logging
import os
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("biometric.config")


def _load_root_env() -> None:
    """Merge the repo-root ``.env`` into the process environment (dev runs).

    Docker compose injects the environment directly and no ``.env`` ships
    inside the image, so this is a no-op in containers. Existing variables
    are never overwritten.
    """
    env_file = next(
        (
            base / ".env"
            for base in Path(__file__).resolve().parents
            if (base / ".env").is_file()
        ),
        None,
    )
    if env_file is None:
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_root_env()

_MONGO_USER = os.getenv("MONGO_USER", "mongoadmin")
_MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "mongopass")
DEFAULT_MONGODB_URL = (
    f"mongodb://{_MONGO_USER}:{_MONGO_PASSWORD}"
    "@localhost:27017/faceattend_biometric?authSource=admin"
)
DEFAULT_MONGO_DB_NAME = "faceattend_biometric"
SECONDS_PER_DAY = 86_400


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BIOMETRIC_", extra="ignore")

    # ── Connection ─────────────────────────────────────────────────────
    mongo_enabled: bool = True
    mongodb_url: str = Field(
        default=DEFAULT_MONGODB_URL,
        validation_alias=AliasChoices("BIOMETRIC_MONGODB_URL", "MONGODB_URL"),
    )
    mongo_db_name: str = DEFAULT_MONGO_DB_NAME
    server_selection_timeout_ms: int = 3_000

    # ── Authentication (session validated against identity, RBAC by authorization) ──
    auth_enabled: bool = True
    identity_url: str = Field(
        default="http://localhost:8081",
        validation_alias=AliasChoices("BIOMETRIC_IDENTITY_URL", "IDENTITY_URL"),
    )
    authorization_url: str = Field(
        default="http://localhost:8082",
        validation_alias=AliasChoices("BIOMETRIC_AUTHORIZATION_URL", "AUTHORIZATION_URL"),
    )
    # Caller/person school resolution (update-request scoping): academic_actor.school_id.
    academic_url: str = Field(
        default="http://localhost:8083",
        validation_alias=AliasChoices("BIOMETRIC_ACADEMIC_URL", "ACADEMIC_URL"),
    )
    # Owner of the canonical biometric update cases (RN-29 re-enrollment check).
    configuration_url: str = Field(
        default="http://localhost:8087",
        validation_alias=AliasChoices("BIOMETRIC_CONFIGURATION_URL", "CONFIGURATION_URL"),
    )

    # ── Health probes ──────────────────────────────────────────────────
    health_ping_timeout_seconds: float = 2.0
    health_cache_seconds: float = 5.0

    # ── Collections ────────────────────────────────────────────────────
    facial_collection: str = "facial_embeddings"
    fingerprint_collection: str = "fingerprint_embeddings"
    update_case_collection: str = "biometric_update_cases"
    match_log_collection: str = "biometric_match_logs"

    # ── Retention & matching ───────────────────────────────────────────
    match_log_retention_days: int = 90
    similarity_threshold: float = 0.85
    # Upper bound for the 1:N identify scan. Reaching it is logged as a warning:
    # it means candidates were not considered, so it must never pass silently.
    identify_scan_limit: int = 10_000
    # Fingerprint raw-sample matching (ported from 10-ms-face-auth) is a
    # keypoint-match COUNT, never compared against `similarity_threshold`
    # (which is cosine-only and face-specific).
    fingerprint_match_threshold: int = 8

    # ── Image/sample compute path (enroll-image, identify-image, enroll-sample,
    # identify-sample, liveness) — ported from 10-ms-face-auth ────────────
    liveness_challenge_secret: str = ""
    liveness_ttl_seconds: int = 120
    rate_limit_max_attempts: int = 20
    rate_limit_window_seconds: int = 60
    max_image_bytes: int = 3 * 1024 * 1024
    max_image_pixels: int = 16_000_000

    # ── WebSocket channel (REST/WS coexistence) ───────────────────────
    # A connection that sends nothing (not even a ping) within this window is
    # presumed dead and closed, so a half-open TCP socket does not pin a slot
    # forever.
    ws_idle_timeout_seconds: int = 60
    # Bounds the idempotency cache below: entries older than this are evicted
    # even if the cache is not full, so a reconnect long after the original
    # attempt reprocesses instead of replaying a stale response.
    ws_idempotency_ttl_seconds: int = 300
    ws_idempotency_max_entries: int = 2_000

    @property
    def match_log_ttl_seconds(self) -> int:
        return self.match_log_retention_days * SECONDS_PER_DAY

    @property
    def liveness_secret_or_ephemeral(self) -> str:
        """HMAC key for liveness challenge tokens.

        Dev/test convenience only: without `BIOMETRIC_LIVENESS_CHALLENGE_SECRET`
        set, a per-process random secret is used (generated once and memoized,
        not regenerated on every call, otherwise tokens signed a moment ago
        would fail to verify) — restarting the process invalidates any
        in-flight challenge. Independent from any JWT/session secret elsewhere
        in the stack — this service never issues JWTs.
        """
        if self.liveness_challenge_secret:
            return self.liveness_challenge_secret
        return _ephemeral_liveness_secret()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings. Cached; tests call `get_settings.cache_clear()`."""
    return Settings()


@lru_cache(maxsize=1)
def _ephemeral_liveness_secret() -> str:
    logger.warning(
        "BIOMETRIC_LIVENESS_CHALLENGE_SECRET not configured: using an "
        "ephemeral per-process secret (development only)"
    )
    return secrets.token_urlsafe(32)
