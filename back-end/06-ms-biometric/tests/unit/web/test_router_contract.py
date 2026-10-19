"""Router contract tests.

They run against the real FastAPI app with the driven ports overridden by the
in-memory doubles from `tests/support/in_memory_repositories.py` — there is no
production singleton left to patch, and no database is required.

MongoDB is explicitly disabled (`BIOMETRIC_MONGO_ENABLED=false`) so the lifespan
cannot reach the network; that also lets these tests pin the degraded-readiness
behaviour.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from domain.value_objects.biometric_type import BiometricType
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
UNIT_VECTOR = [1.0, 0.0, 0.0, 0.0]
ORTHOGONAL_VECTOR = [0.0, 1.0, 0.0, 0.0]

FACIAL_PREFIX = "/api/v1/biometric/facial"
FINGERPRINT_PREFIX = "/api/v1/biometric/fingerprint"

EXPECTED_ROUTES = {
    ("POST", f"{FACIAL_PREFIX}/enroll"),
    ("GET", f"{FACIAL_PREFIX}/{{person_id}}"),
    ("GET", f"{FACIAL_PREFIX}/{{person_id}}/history"),
    ("DELETE", f"{FACIAL_PREFIX}/{{person_id}}"),
    ("POST", f"{FACIAL_PREFIX}/verify"),
    ("POST", f"{FACIAL_PREFIX}/identify"),
    ("GET", f"{FACIAL_PREFIX}/liveness-challenge"),
    ("POST", f"{FACIAL_PREFIX}/liveness-step"),
    ("POST", f"{FACIAL_PREFIX}/enroll-image"),
    ("POST", f"{FACIAL_PREFIX}/identify-image"),
    ("POST", f"{FINGERPRINT_PREFIX}/enroll"),
    ("GET", f"{FINGERPRINT_PREFIX}/{{person_id}}"),
    ("GET", f"{FINGERPRINT_PREFIX}/{{person_id}}/{{finger}}"),
    ("DELETE", f"{FINGERPRINT_PREFIX}/{{person_id}}/{{finger}}"),
    ("POST", f"{FINGERPRINT_PREFIX}/verify"),
    ("POST", f"{FINGERPRINT_PREFIX}/identify"),
    ("POST", f"{FINGERPRINT_PREFIX}/enroll-sample"),
    ("POST", f"{FINGERPRINT_PREFIX}/identify-sample"),
    ("POST", "/api/v1/biometric/update-request"),
    ("GET", "/api/v1/biometric/update-requests/{person_id}"),
    ("PATCH", "/api/v1/biometric/update-request/{request_id}/review"),
    ("DELETE", "/api/v1/biometric/update-request/{request_id}"),
    ("GET", "/api/v1/biometric/{person_id}/summary"),
    ("GET", "/health"),
    ("GET", "/health/live"),
    ("GET", "/health/ready"),
    ("GET", "/api/v1/health"),
    ("GET", "/api/v1/biometric/health"),
}


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
    get_settings.cache_clear()

    app.dependency_overrides[get_facial_repository] = lambda: stores["facial"]
    app.dependency_overrides[get_fingerprint_repository] = lambda: stores["fingerprint"]
    app.dependency_overrides[get_update_case_repository] = lambda: stores["update_cases"]
    app.dependency_overrides[get_match_log_repository] = lambda: stores["match_logs"]

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    get_settings.cache_clear()


def _enroll_facial(client, person_id=PERSON, encoding=UNIT_VECTOR):
    return client.post(
        f"{FACIAL_PREFIX}/enroll",
        json={
            "person_id": person_id,
            "encoding": encoding,
            "model_version": "facenet-v1",
        },
    )


def _enroll_fingerprint(client, person_id=PERSON, finger_number=1, encoding=UNIT_VECTOR):
    return client.post(
        f"{FINGERPRINT_PREFIX}/enroll",
        json={
            "person_id": person_id,
            "finger_number": finger_number,
            "encoding": encoding,
            "model_version": "fingerprint-v1",
        },
    )


class TestRouteTable:
    def test_every_business_route_is_mounted_under_the_gateway_prefix(self, client):
        """Kong forwards `/api/v1/biometric` with strip_path=false, so the full
        prefix must be served by the app itself."""
        actual = {
            (method, route.path)
            for route in app.routes
            for method in getattr(route, "methods", set())
            if getattr(route, "include_in_schema", True) or route.path.startswith("/health")
        }
        missing = EXPECTED_ROUTES - actual
        assert not missing, f"routes not mounted: {sorted(missing)}"

    def test_no_business_route_leaked_outside_the_prefix(self, client):
        for route in app.routes:
            path = getattr(route, "path", "")
            if path.startswith("/health") or path in {"/api/v1/health"}:
                continue
            if path.startswith(("/openapi.json", "/docs", "/redoc")):
                continue
            assert path.startswith("/api/v1/biometric"), f"unexpected route {path}"


class TestFacialEndpoints:
    def test_enroll_returns_the_persisted_template(self, client):
        response = _enroll_facial(client)
        assert response.status_code == 201
        body = response.json()
        assert body["person_id"] == PERSON
        assert body["encoding"] == UNIT_VECTOR
        assert body["model_version"] == "facenet-v1"
        assert body["is_active"] is True
        assert body["template_version"] == 1
        assert body["_id"]
        assert body["enrolled_at"]

    def test_get_active_template(self, client):
        created = _enroll_facial(client).json()
        response = client.get(f"{FACIAL_PREFIX}/{PERSON}")
        assert response.status_code == 200
        assert response.json()["_id"] == created["_id"]

    def test_get_missing_template_is_404(self, client):
        assert client.get(f"{FACIAL_PREFIX}/{PERSON}").status_code == 404

    def test_reenroll_supersedes_and_bumps_the_version(self, client):
        first = _enroll_facial(client).json()
        second = _enroll_facial(client, encoding=[0.9, 0.1, 0.0, 0.0]).json()

        assert second["template_version"] == first["template_version"] + 1
        assert client.get(f"{FACIAL_PREFIX}/{PERSON}").json()["_id"] == second["_id"]

        history = client.get(f"{FACIAL_PREFIX}/{PERSON}/history").json()["history"]
        assert [entry["_id"] for entry in history] == [first["_id"], second["_id"]]
        assert [entry["is_active"] for entry in history] == [False, True]

    def test_delete_is_soft_and_hides_the_template(self, client, stores):
        created = _enroll_facial(client).json()

        assert client.delete(f"{FACIAL_PREFIX}/{PERSON}").status_code == 204
        assert client.get(f"{FACIAL_PREFIX}/{PERSON}").status_code == 404
        assert client.delete(f"{FACIAL_PREFIX}/{PERSON}").status_code == 404

        # The document must still exist, flagged — never removed.
        stored = stores["facial"].stored()
        assert len(stored) == 1
        assert stored[0].embedding_id == created["_id"]
        assert stored[0].is_active is False
        assert stored[0].deleted_at is not None

        # Soft-deleted versions disappear from history too.
        assert client.get(f"{FACIAL_PREFIX}/{PERSON}/history").json()["history"] == []

    def test_verify_match_and_mismatch(self, client):
        _enroll_facial(client)
        assert client.post(
            f"{FACIAL_PREFIX}/verify", json={"person_id": PERSON, "encoding": UNIT_VECTOR}
        ).json() == {"match": True, "score": pytest.approx(1.0)}

        mismatch = client.post(
            f"{FACIAL_PREFIX}/verify", json={"person_id": PERSON, "encoding": ORTHOGONAL_VECTOR}
        )
        assert mismatch.json()["match"] is False
        assert mismatch.json()["score"] == pytest.approx(0.0)

    def test_verify_without_template_is_404(self, client):
        response = client.post(
            f"{FACIAL_PREFIX}/verify", json={"person_id": PERSON, "encoding": UNIT_VECTOR}
        )
        assert response.status_code == 404

    def test_identify_finds_the_closest_person(self, client):
        _enroll_facial(client, person_id=PERSON, encoding=UNIT_VECTOR)
        _enroll_facial(client, person_id=OTHER_PERSON, encoding=ORTHOGONAL_VECTOR)

        response = client.post(f"{FACIAL_PREFIX}/identify", json={"encoding": UNIT_VECTOR})
        assert response.status_code == 200
        assert response.json() == {"person_id": PERSON, "score": pytest.approx(1.0)}

    def test_identify_below_threshold_is_404(self, client):
        _enroll_facial(client, person_id=OTHER_PERSON, encoding=ORTHOGONAL_VECTOR)
        response = client.post(
            f"{FACIAL_PREFIX}/identify", json={"encoding": UNIT_VECTOR}
        )
        assert response.status_code == 404

    def test_identify_ignores_soft_deleted_templates(self, client):
        _enroll_facial(client)
        client.delete(f"{FACIAL_PREFIX}/{PERSON}")
        assert client.post(
            f"{FACIAL_PREFIX}/identify", json={"encoding": UNIT_VECTOR}
        ).status_code == 404

    def test_invalid_payload_is_422(self, client):
        response = client.post(f"{FACIAL_PREFIX}/enroll", json={"person_id": "", "encoding": []})
        assert response.status_code == 422
        assert response.json()["error"] == "BadRequest"


class TestFingerprintEndpoints:
    def test_enroll_and_read_back_a_single_finger(self, client):
        created = _enroll_fingerprint(client, finger_number=3).json()
        assert created["finger_number"] == 3

        assert client.get(f"{FINGERPRINT_PREFIX}/{PERSON}/3").json()["_id"] == created["_id"]
        assert client.get(f"{FINGERPRINT_PREFIX}/{PERSON}/4").status_code == 404

        templates = client.get(f"{FINGERPRINT_PREFIX}/{PERSON}").json()["templates"]
        assert [template["finger_number"] for template in templates] == [3]

    def test_fingers_are_independent_scopes(self, client):
        thumb = _enroll_fingerprint(client, finger_number=1).json()
        index = _enroll_fingerprint(client, finger_number=2).json()

        assert thumb["template_version"] == 1
        assert index["template_version"] == 1

        templates = client.get(f"{FINGERPRINT_PREFIX}/{PERSON}").json()["templates"]
        assert sorted(template["finger_number"] for template in templates) == [1, 2]

    def test_delete_only_affects_the_requested_finger(self, client, stores):
        _enroll_fingerprint(client, finger_number=1)
        _enroll_fingerprint(client, finger_number=2)

        assert client.delete(f"{FINGERPRINT_PREFIX}/{PERSON}/1").status_code == 204
        assert client.get(f"{FINGERPRINT_PREFIX}/{PERSON}/1").status_code == 404
        assert client.get(f"{FINGERPRINT_PREFIX}/{PERSON}/2").status_code == 200
        assert len(stores["fingerprint"].stored()) == 2

    def test_finger_number_out_of_range_is_422(self, client):
        response = client.post(
            f"{FINGERPRINT_PREFIX}/enroll",
            json={"person_id": PERSON, "finger_number": 11, "encoding": UNIT_VECTOR},
        )
        assert response.status_code == 422

    def test_verify_uses_the_requested_finger(self, client):
        _enroll_fingerprint(client, finger_number=1, encoding=UNIT_VECTOR)
        _enroll_fingerprint(client, finger_number=2, encoding=ORTHOGONAL_VECTOR)

        hit = client.post(
            f"{FINGERPRINT_PREFIX}/verify",
            json={"person_id": PERSON, "finger_number": 1, "encoding": UNIT_VECTOR},
        ).json()
        miss = client.post(
            f"{FINGERPRINT_PREFIX}/verify",
            json={"person_id": PERSON, "finger_number": 2, "encoding": UNIT_VECTOR},
        ).json()
        assert hit["match"] is True
        assert miss["match"] is False

    def test_identify_can_be_filtered_by_finger(self, client):
        _enroll_fingerprint(client, person_id=PERSON, finger_number=1, encoding=UNIT_VECTOR)
        _enroll_fingerprint(
            client, person_id=OTHER_PERSON, finger_number=2, encoding=UNIT_VECTOR
        )

        filtered = client.post(
            f"{FINGERPRINT_PREFIX}/identify",
            json={"encoding": UNIT_VECTOR, "finger_number": 2},
        )
        assert filtered.status_code == 200
        assert filtered.json()["person_id"] == OTHER_PERSON
        assert filtered.json()["finger_number"] == 2


class TestUpdateRequestEndpoints:
    def _create(self, client, person_id=PERSON):
        return client.post(
            "/api/v1/biometric/update-request",
            json={
                "person_id": person_id,
                "biometric_type": "FACIAL",
                "reason": "Cambio de apariencia",
            },
        )

    def test_create_returns_a_pending_case(self, client):
        response = self._create(client)
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "Pending"
        assert body["person_id"] == PERSON
        assert body["biometric_type"] == "FACIAL"
        assert body["reason"] == "Cambio de apariencia"
        assert body["request_id"]
        assert body["requested_at"]
        assert body["reviewed_at"] is None

    def test_list_is_scoped_to_the_person(self, client):
        self._create(client)
        self._create(client, person_id=OTHER_PERSON)

        assert len(client.get(f"/api/v1/biometric/update-requests/{PERSON}").json()["requests"]) == 1
        assert (
            len(client.get(f"/api/v1/biometric/update-requests/{OTHER_PERSON}").json()["requests"])
            == 1
        )

    def test_review_transitions_and_stamps_the_decision(self, client):
        request_id = self._create(client).json()["request_id"]

        in_review = client.patch(
            f"/api/v1/biometric/update-request/{request_id}/review",
            json={"status": "In_Review"},
        )
        assert in_review.status_code == 200
        assert in_review.json()["status"] == "In_Review"
        assert in_review.json()["reviewed_at"] is None

        approved = client.patch(
            f"/api/v1/biometric/update-request/{request_id}/review",
            json={"status": "Approved"},
        )
        assert approved.json()["status"] == "Approved"
        assert approved.json()["reviewed_at"] is not None

    def test_review_unknown_case_is_404(self, client):
        response = client.patch(
            "/api/v1/biometric/update-request/does-not-exist/review",
            json={"status": "Approved"},
        )
        assert response.status_code == 404

    def test_review_rejects_unknown_status(self, client):
        request_id = self._create(client).json()["request_id"]
        response = client.patch(
            f"/api/v1/biometric/update-request/{request_id}/review",
            json={"status": "Cancelled"},
        )
        assert response.status_code == 422

    def test_delete_is_soft(self, client, stores):
        request_id = self._create(client).json()["request_id"]

        assert client.delete(f"/api/v1/biometric/update-request/{request_id}").status_code == 204
        assert client.delete(f"/api/v1/biometric/update-request/{request_id}").status_code == 404
        assert client.get(f"/api/v1/biometric/update-requests/{PERSON}").json()["requests"] == []
        assert (
            client.patch(
                f"/api/v1/biometric/update-request/{request_id}/review",
                json={"status": "Approved"},
            ).status_code
            == 404
        )

        stored = stores["update_cases"].stored()
        assert len(stored) == 1
        assert stored[0].deleted_at is not None
        assert stored[0].is_active is False

    def test_invalid_biometric_type_is_422(self, client):
        response = client.post(
            "/api/v1/biometric/update-request",
            json={"person_id": PERSON, "biometric_type": "IRIS", "reason": "x"},
        )
        assert response.status_code == 422


class TestMatchAudit:
    def test_verify_writes_a_match_log(self, client, stores):
        _enroll_facial(client)
        client.post(
            f"{FACIAL_PREFIX}/verify", json={"person_id": PERSON, "encoding": UNIT_VECTOR}
        )

        entries = stores["match_logs"].entries
        assert len(entries) == 1
        assert entries[0].operation == "VERIFY"
        assert entries[0].biometric_type is BiometricType.FACIAL
        assert entries[0].matched is True
        assert entries[0].person_id == PERSON
        assert entries[0].threshold == pytest.approx(0.85)

    def test_failed_identify_is_audited(self, client, stores):
        _enroll_facial(client, person_id=OTHER_PERSON, encoding=ORTHOGONAL_VECTOR)
        assert client.post(
            f"{FACIAL_PREFIX}/identify", json={"encoding": UNIT_VECTOR}
        ).status_code == 404

        entries = stores["match_logs"].entries
        assert len(entries) == 1
        assert entries[0].operation == "IDENTIFY"
        assert entries[0].matched is False
        assert entries[0].matched_person_id is None

    def test_verify_without_template_is_not_audited(self, client, stores):
        client.post(
            f"{FACIAL_PREFIX}/verify", json={"person_id": PERSON, "encoding": UNIT_VECTOR}
        )
        assert stores["match_logs"].entries == []


class TestHealthEndpoints:
    def test_health_is_served_at_the_root_and_never_fails_on_mongo(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["service"] == "biometric-service"
        assert body["dependencies"]["mongodb"] == "disabled"

    def test_live_probe_never_touches_the_database(self, client):
        response = client.get("/health/live")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_ready_probe_reports_degraded_when_persistence_is_unavailable(self, client):
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json()["status"] == "degraded"

    def test_gateway_health_alias(self, client):
        assert client.get("/api/v1/health").status_code == 200

    def test_correlation_headers_are_present(self, client):
        response = client.get("/health", headers={"x-request-id": "trace-123"})
        assert response.headers["x-request-id"] == "trace-123"
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"


class TestErrorEnvelope:
    def test_unknown_path_returns_the_uniform_404_envelope(self, client):
        response = client.get("/api/v1/biometric/nope")
        assert response.status_code == 404
        body = response.json()
        assert body["error"] == "NotFound"
        assert body["path"] == "/api/v1/biometric/nope"
        assert body["timestamp"]
