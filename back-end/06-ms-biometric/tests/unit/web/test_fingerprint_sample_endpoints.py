"""Fingerprint raw-sample endpoints — ported behavior from `10-ms-face-auth`.

`domain.fingerprint_decode.decode_fingerprint` and
`domain.fingerprint_matching.fingerprint_keypoint_score` are monkeypatched so
these tests exercise router/use-case logic (dedup, quality gate, audit)
without needing real OpenCV decoding or real fingerprint images.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from domain.value_objects.biometric_type import BiometricType
import infrastructure.config.dependencies as dependencies
import infrastructure.web.routers.fingerprint_router as fingerprint_router
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
FINGERPRINT_PREFIX = "/api/v1/biometric/fingerprint"
FAKE_SAMPLE = "aGVsbG8="


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
    monkeypatch.setenv("BIOMETRIC_RATE_LIMIT_MAX_ATTEMPTS", "1000")
    monkeypatch.setattr(
        fingerprint_router, "decode_fingerprint", lambda data, max_bytes, max_pixels: data
    )
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


def _enroll_sample(client, person_id=PERSON, finger_number=1, data=FAKE_SAMPLE, quality=80):
    return client.post(
        f"{FINGERPRINT_PREFIX}/enroll-sample",
        json={
            "person_id": person_id,
            "finger_number": finger_number,
            "data_base64": data,
            "quality": quality,
        },
    )


class TestEnrollSample:
    def test_enroll_sample_persists_the_raw_sample(self, client, monkeypatch):
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 0)
        response = _enroll_sample(client)
        assert response.status_code == 201
        body = response.json()
        assert body["raw_sample_b64"] == FAKE_SAMPLE
        assert body["encoding"] == []

    def test_enroll_sample_rejects_low_quality(self, client, monkeypatch):
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 0)
        response = _enroll_sample(client, quality=5)
        assert response.status_code == 400

    def test_enroll_sample_rejects_a_fingerprint_already_enrolled_elsewhere(self, client, monkeypatch):
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 50)
        _enroll_sample(client, person_id=OTHER_PERSON)
        response = _enroll_sample(client, person_id=PERSON, data="b3RoZXI=")
        assert response.status_code == 409

    def test_enroll_sample_allows_reenrolling_the_same_person(self, client, monkeypatch):
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 50)
        first = _enroll_sample(client, person_id=PERSON).json()
        second = _enroll_sample(client, person_id=PERSON, data="b3RoZXI=").json()
        assert second["template_version"] == first["template_version"] + 1


class TestIdentifySample:
    def test_identify_sample_finds_the_closest_person(self, client, monkeypatch):
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 0)
        _enroll_sample(client, person_id=PERSON)
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 20)
        response = client.post(
            f"{FINGERPRINT_PREFIX}/identify-sample",
            json={"data_base64": FAKE_SAMPLE},
        )
        assert response.status_code == 200
        assert response.json()["person_id"] == PERSON

    def test_identify_sample_below_threshold_is_404(self, client, monkeypatch):
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 0)
        _enroll_sample(client, person_id=PERSON)
        response = client.post(
            f"{FINGERPRINT_PREFIX}/identify-sample",
            json={"data_base64": FAKE_SAMPLE},
        )
        assert response.status_code == 404

    def test_identify_sample_ignores_vector_based_records(self, client, monkeypatch):
        # A record enrolled through the pre-existing vector endpoint has no
        # raw_sample_b64 and must never be scanned by the keypoint matcher.
        client.post(
            f"{FINGERPRINT_PREFIX}/enroll",
            json={
                "person_id": PERSON,
                "finger_number": 1,
                "encoding": [1.0, 0.0, 0.0, 0.0],
                "model_version": "fingerprint-v1",
            },
        )
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 999)
        response = client.post(
            f"{FINGERPRINT_PREFIX}/identify-sample",
            json={"data_base64": FAKE_SAMPLE},
        )
        assert response.status_code == 404

    def test_identify_sample_can_be_filtered_by_finger(self, client, monkeypatch):
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 0)
        _enroll_sample(client, person_id=PERSON, finger_number=1)
        _enroll_sample(client, person_id=OTHER_PERSON, finger_number=2)
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 20)
        response = client.post(
            f"{FINGERPRINT_PREFIX}/identify-sample",
            json={"data_base64": FAKE_SAMPLE, "finger_number": 2},
        )
        assert response.status_code == 200
        assert response.json()["person_id"] == OTHER_PERSON
