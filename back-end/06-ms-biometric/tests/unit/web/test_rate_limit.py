"""Rate limiter — unit tests for `infrastructure/security/rate_limit.py` and
the image/sample endpoints it guards (ported from `10-ms-face-auth`'s
`test_lifecycle_security.py` limiter boundary tests)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from domain.value_objects.biometric_type import BiometricType
import infrastructure.config.dependencies as dependencies
import infrastructure.web.routers.facial_router as facial_router
from infrastructure.config.dependencies import (
    get_facial_repository,
    get_fingerprint_repository,
    get_match_log_repository,
    get_update_case_repository,
)
from infrastructure.config.settings import get_settings
from infrastructure.security.rate_limit import RateLimiter
from main import app
from tests.support.in_memory_repositories import (
    InMemoryBiometricRepository,
    InMemoryMatchLogRepository,
    InMemoryUpdateCaseRepository,
)

FACIAL_PREFIX = "/api/v1/biometric/facial"


class TestRateLimiter:
    def test_allows_up_to_max_attempts_then_blocks(self):
        limiter = RateLimiter(max_attempts=3, window_seconds=60)
        for _ in range(3):
            allowed, _ = limiter.check("key")
            assert allowed is True
        allowed, remaining = limiter.check("key")
        assert allowed is False
        assert remaining == 0

    def test_different_keys_are_independent(self):
        limiter = RateLimiter(max_attempts=1, window_seconds=60)
        assert limiter.check("a")[0] is True
        assert limiter.check("b")[0] is True
        assert limiter.check("a")[0] is False

    def test_reset_clears_a_key(self):
        limiter = RateLimiter(max_attempts=1, window_seconds=60)
        limiter.check("key")
        assert limiter.check("key")[0] is False
        limiter.reset("key")
        assert limiter.check("key")[0] is True


@pytest.fixture
def stores():
    return {
        "facial": InMemoryBiometricRepository(BiometricType.FACIAL),
        "fingerprint": InMemoryBiometricRepository(BiometricType.FINGERPRINT),
        "update_cases": InMemoryUpdateCaseRepository(),
        "match_logs": InMemoryMatchLogRepository(),
    }


@pytest.fixture
def client(monkeypatch, stores):
    monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
    monkeypatch.setenv("BIOMETRIC_LIVENESS_CHALLENGE_SECRET", "test-secret")
    monkeypatch.setenv("BIOMETRIC_RATE_LIMIT_MAX_ATTEMPTS", "2")
    monkeypatch.setenv("BIOMETRIC_RATE_LIMIT_WINDOW_SECONDS", "60")
    monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
    monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: True)
    dependencies._rate_limiters.clear()
    get_settings.cache_clear()

    app.dependency_overrides[get_facial_repository] = lambda: stores["facial"]
    app.dependency_overrides[get_fingerprint_repository] = lambda: stores["fingerprint"]
    app.dependency_overrides[get_update_case_repository] = lambda: stores["update_cases"]
    app.dependency_overrides[get_match_log_repository] = lambda: stores["match_logs"]

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    dependencies._rate_limiters.clear()
    get_settings.cache_clear()


class TestLivenessStepRateLimit:
    def test_liveness_step_is_blocked_after_the_configured_attempts(self, client):
        challenge = client.get(f"{FACIAL_PREFIX}/liveness-challenge", params={"actions": 2}).json()
        token = challenge["challenge_token"]
        payload = {"challenge_token": token, "action_index": 0, "images": ["x"] * 6}

        first = client.post(f"{FACIAL_PREFIX}/liveness-step", json=payload)
        assert first.status_code in (200, 400)  # token reuse across attempts still counts

        second = client.post(f"{FACIAL_PREFIX}/liveness-step", json=payload)
        assert second.status_code in (200, 400)

        third = client.post(f"{FACIAL_PREFIX}/liveness-step", json=payload)
        assert third.status_code == 429

    def test_clients_behind_the_same_gateway_get_separate_buckets(self, client):
        # Every request arrives from Kong; the bucket must follow the real caller.
        challenge = client.get(f"{FACIAL_PREFIX}/liveness-challenge", params={"actions": 2}).json()
        payload = {"challenge_token": challenge["challenge_token"], "action_index": 0, "images": ["x"] * 6}
        for _ in range(2):
            client.post(f"{FACIAL_PREFIX}/liveness-step", json=payload, headers={"X-Real-IP": "203.0.113.1"})
        blocked = client.post(f"{FACIAL_PREFIX}/liveness-step", json=payload, headers={"X-Real-IP": "203.0.113.1"})
        other = client.post(f"{FACIAL_PREFIX}/liveness-step", json=payload, headers={"X-Real-IP": "203.0.113.2"})
        assert blocked.status_code == 429
        assert other.status_code != 429


class TestRateLimitCaller:
    class _Request:
        def __init__(self, user_id=None, headers=None, host="10.0.0.5"):
            self.state = type("State", (), {"user_id": user_id})()
            self.headers = headers or {}
            self.client = type("Client", (), {"host": host})()

    def test_the_authenticated_user_wins_over_any_address(self):
        request = self._Request(user_id="u-1", headers={"x-real-ip": "203.0.113.9"})
        assert dependencies._rate_limit_caller(request) == "user:u-1"

    def test_without_a_user_the_gateway_forwarded_address_is_used(self):
        assert dependencies._rate_limit_caller(self._Request(headers={"x-real-ip": "203.0.113.9"})) == "ip:203.0.113.9"

    def test_direct_calls_fall_back_to_the_socket_address(self):
        assert dependencies._rate_limit_caller(self._Request()) == "ip:10.0.0.5"
