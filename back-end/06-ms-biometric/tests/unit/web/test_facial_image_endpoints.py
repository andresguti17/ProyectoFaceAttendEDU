"""Facial image/liveness endpoints — ported behavior from `10-ms-face-auth`.

`domain.face_encoding.face_encoding`/`validate_liveness` are monkeypatched so
these tests exercise router/use-case logic (dedup, liveness token lifecycle,
audit) without needing real dlib/OpenCV calls or real images.
"""
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
from main import app
from tests.support.in_memory_repositories import (
    InMemoryBiometricRepository,
    InMemoryMatchLogRepository,
    InMemoryUpdateCaseRepository,
)

PERSON = "550e8400-e29b-41d4-a716-446655440000"
OTHER_PERSON = "550e8400-e29b-41d4-a716-446655440001"
FACIAL_PREFIX = "/api/v1/biometric/facial"
FAKE_IMAGE = "aGVsbG8="  # arbitrary base64, never actually decoded by face_recognition in these tests
SECRET = "test-liveness-secret"


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
    monkeypatch.setenv("BIOMETRIC_LIVENESS_CHALLENGE_SECRET", SECRET)
    # Rate limiter buckets are keyed per-process; isolate this test from others.
    monkeypatch.setenv("BIOMETRIC_RATE_LIMIT_MAX_ATTEMPTS", "1000")
    dependencies._rate_limiters.clear()
    get_settings.cache_clear()

    app.dependency_overrides[get_facial_repository] = lambda: stores["facial"]
    app.dependency_overrides[get_fingerprint_repository] = lambda: stores["fingerprint"]
    app.dependency_overrides[get_update_case_repository] = lambda: stores["update_cases"]
    app.dependency_overrides[get_match_log_repository] = lambda: stores["match_logs"]

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    get_settings.cache_clear()


def _challenge(client, actions=2):
    response = client.get(f"{FACIAL_PREFIX}/liveness-challenge", params={"actions": actions})
    assert response.status_code == 200
    return response.json()


class TestLiveness:
    def test_challenge_returns_the_requested_number_of_actions(self, client):
        body = _challenge(client, actions=2)
        assert len(body["actions"]) == 2
        assert body["challenge_token"]

    def test_invalid_action_count_is_rejected(self, client):
        assert client.get(f"{FACIAL_PREFIX}/liveness-challenge", params={"actions": 5}).status_code == 422

    def test_full_liveness_flow_completes(self, client, monkeypatch):
        monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
        monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: True)
        challenge = _challenge(client, actions=2)
        token = challenge["challenge_token"]
        for step in range(2):
            response = client.post(
                f"{FACIAL_PREFIX}/liveness-step",
                json={
                    "challenge_token": token,
                    "action_index": step,
                    "images": [FAKE_IMAGE] * 6,
                },
            )
            assert response.status_code == 200
            body = response.json()
            token = body["challenge_token"]
        assert body["completed"] is True

    def test_failed_gesture_is_rejected_and_audited(self, client, monkeypatch, stores):
        monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
        monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: False)
        challenge = _challenge(client, actions=2)
        response = client.post(
            f"{FACIAL_PREFIX}/liveness-step",
            json={
                "challenge_token": challenge["challenge_token"],
                "action_index": 0,
                "images": [FAKE_IMAGE] * 6,
            },
        )
        assert response.status_code == 400
        assert stores["match_logs"].entries[-1].operation == "LIVENESS_FAILURE"

    def test_reused_liveness_step_is_rejected(self, client, monkeypatch):
        monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
        monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: True)
        challenge = _challenge(client, actions=2)
        token = challenge["challenge_token"]
        payload = {"challenge_token": token, "action_index": 0, "images": [FAKE_IMAGE] * 6}
        first = client.post(f"{FACIAL_PREFIX}/liveness-step", json=payload)
        assert first.status_code == 200
        replay = client.post(f"{FACIAL_PREFIX}/liveness-step", json=payload)
        assert replay.status_code == 400


def _completed_challenge_token(client, monkeypatch, actions=2):
    """A liveness token that has actually been advanced through every step —
    `consume_liveness_challenge` (used by enroll-image/identify-image)
    requires `step == len(actions)`, so grabbing a freshly-created token
    without walking the liveness-step flow first always fails with
    "not completed". Confirmed by hitting exactly that 400 before fixing."""
    monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
    monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: True)
    challenge = _challenge(client, actions=actions)
    token = challenge["challenge_token"]
    for step in range(len(challenge["actions"])):
        response = client.post(
            f"{FACIAL_PREFIX}/liveness-step",
            json={"challenge_token": token, "action_index": step, "images": [FAKE_IMAGE] * 6},
        )
        assert response.status_code == 200, response.json()
        token = response.json()["challenge_token"]
    return token


class TestEnrollImage:
    def _consume_challenge(self, client, monkeypatch, encoding):
        monkeypatch.setattr(facial_router, "face_encoding", lambda image: encoding)
        return _completed_challenge_token(client, monkeypatch)

    def test_enroll_image_persists_the_computed_encoding(self, client, monkeypatch):
        token = self._consume_challenge(client, monkeypatch, [1.0, 0.0, 0.0, 0.0])
        response = client.post(
            f"{FACIAL_PREFIX}/enroll-image",
            json={"person_id": PERSON, "image_base64": FAKE_IMAGE, "challenge_token": token},
        )
        assert response.status_code == 201
        assert response.json()["encoding"] == [1.0, 0.0, 0.0, 0.0]

    def test_enroll_image_rejects_a_face_already_enrolled_elsewhere(self, client, monkeypatch):
        token = self._consume_challenge(client, monkeypatch, [1.0, 0.0, 0.0, 0.0])
        client.post(
            f"{FACIAL_PREFIX}/enroll-image",
            json={"person_id": OTHER_PERSON, "image_base64": FAKE_IMAGE, "challenge_token": token},
        )
        token2 = self._consume_challenge(client, monkeypatch, [1.0, 0.0, 0.0, 0.0])
        response = client.post(
            f"{FACIAL_PREFIX}/enroll-image",
            json={"person_id": PERSON, "image_base64": FAKE_IMAGE, "challenge_token": token2},
        )
        assert response.status_code == 409

    def test_enroll_image_rejects_a_frame_with_no_face(self, client, monkeypatch):
        token = self._consume_challenge(client, monkeypatch, None)
        response = client.post(
            f"{FACIAL_PREFIX}/enroll-image",
            json={"person_id": PERSON, "image_base64": FAKE_IMAGE, "challenge_token": token},
        )
        assert response.status_code == 400

    def test_enroll_image_requires_a_valid_liveness_token(self, client):
        response = client.post(
            f"{FACIAL_PREFIX}/enroll-image",
            json={"person_id": PERSON, "image_base64": FAKE_IMAGE, "challenge_token": "garbage"},
        )
        assert response.status_code == 400


class TestIdentifyImage:
    def _consume_challenge(self, client, monkeypatch, encoding):
        monkeypatch.setattr(facial_router, "face_encoding", lambda image: encoding)
        return _completed_challenge_token(client, monkeypatch)

    def test_identify_image_finds_the_closest_person(self, client, monkeypatch):
        enroll_token = self._consume_challenge(client, monkeypatch, [1.0, 0.0, 0.0, 0.0])
        client.post(
            f"{FACIAL_PREFIX}/enroll-image",
            json={"person_id": PERSON, "image_base64": FAKE_IMAGE, "challenge_token": enroll_token},
        )
        identify_token = self._consume_challenge(client, monkeypatch, [1.0, 0.0, 0.0, 0.0])
        response = client.post(
            f"{FACIAL_PREFIX}/identify-image",
            json={"image_base64": FAKE_IMAGE, "challenge_token": identify_token},
        )
        assert response.status_code == 200
        assert response.json()["person_id"] == PERSON

    def test_identify_image_with_no_match_is_404(self, client, monkeypatch):
        token = self._consume_challenge(client, monkeypatch, [0.0, 1.0, 0.0, 0.0])
        response = client.post(
            f"{FACIAL_PREFIX}/identify-image",
            json={"image_base64": FAKE_IMAGE, "challenge_token": token},
        )
        assert response.status_code == 404
