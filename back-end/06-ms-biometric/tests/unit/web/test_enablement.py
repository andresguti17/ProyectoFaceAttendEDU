"""Terms and guardian enablement in the biometric service.

A learner who has not accepted the terms (a minor: without a registered guardian and the
guardian acceptance) cannot enroll a face; a minor cannot enroll their own face; and the
administrator who enrolls someone is kept in the audit log.
"""
from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from domain.value_objects.biometric_type import BiometricType
from infrastructure.config.dependencies import (
    get_facial_repository,
    get_fingerprint_repository,
    get_match_log_repository,
)
from infrastructure.config.settings import get_settings
from infrastructure.web import security
from main import app
from tests.support.in_memory_repositories import InMemoryBiometricRepository, InMemoryMatchLogRepository

ADMIN = "11111111-1111-1111-1111-111111111111"
STUDENT = "22222222-2222-2222-2222-222222222222"

ENABLED = {"enabled": True, "minor": False, "pendingStep": "NONE"}
MINOR_ENABLED = {"enabled": True, "minor": True, "pendingStep": "NONE"}
GUARDIAN_PENDING = {"enabled": False, "minor": True, "pendingStep": "GUARDIAN"}
TERMS_PENDING = {"enabled": False, "minor": False, "pendingStep": "TERMS"}


def _fake(terms: dict[str, object]):
    async def fake_get_json(url: str, token: str):
        if "/api/v1/sessions/" in url:
            user = {ADMIN: "admin", STUDENT: "student"}.get(url.rsplit("/", 1)[1])
            return (200, {"sessionStatus": "Active", "userId": user}) if user else (404, None)
        if url.endswith("/consent"):
            return 200, {"biometricAuthorized": True}
        if url.endswith("/terms"):
            answer = terms[url.split("/persons/")[1].split("/")[0]]
            if isinstance(answer, Exception):
                raise answer
            return answer if isinstance(answer, tuple) else (200, answer)
        if "/api/v1/users/" in url and "?" not in url:
            person = {"admin": "person-admin", "student": "person-student"}.get(url.rsplit("/", 1)[1])
            return (200, {"personId": person}) if person else (404, None)
        if "/academic-actors" in url:
            return 200, {"schoolId": "school-1"}
        user = url.split("userId=")[1].split("&")[0]
        permission = url.split("permission=")[1]
        allowed = {"admin": {"attendance.record:write"}, "student": {"biometric.case:request"}}[user]
        return 200, {"allowed": permission.replace("%3A", ":") in allowed}

    return fake_get_json


async def _fake_get_list(url: str, token: str) -> list:
    if "/roles" in url:
        return [{"roleName": "Administrador" if "/users/admin/" in url else "Aprendiz"}]
    return [{"schoolId": "school-1"}] if "/academic-actors" in url else []


@pytest.fixture
def repos():
    return {
        "facial": InMemoryBiometricRepository(BiometricType.FACIAL),
        "fingerprint": InMemoryBiometricRepository(BiometricType.FINGERPRINT),
        "logs": InMemoryMatchLogRepository(),
    }


@pytest.fixture
def make_client(monkeypatch, repos):
    def build(terms):
        monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
        monkeypatch.setenv("BIOMETRIC_AUTH_ENABLED", "true")
        monkeypatch.setenv("BIOMETRIC_CONSENT_CHECK_ENABLED", "true")
        monkeypatch.setenv("BIOMETRIC_ENABLEMENT_CHECK_ENABLED", "true")
        get_settings.cache_clear()
        security._session_cache.clear()
        security._eval_cache.clear()
        security._caller_school_cache.clear()
        monkeypatch.setattr(security, "_get_json", _fake(terms))
        monkeypatch.setattr(security, "_get_list", _fake_get_list)
        app.dependency_overrides[get_facial_repository] = lambda: repos["facial"]
        app.dependency_overrides[get_fingerprint_repository] = lambda: repos["fingerprint"]
        app.dependency_overrides[get_match_log_repository] = lambda: repos["logs"]
        return TestClient(app)

    yield build
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def _enroll(client, person_id, token=ADMIN):
    return client.post(
        "/api/v1/biometric/facial/enroll",
        json={"person_id": person_id, "encoding": [0.01] * 128},
        headers={"Authorization": f"Bearer {token}"},
    )


def test_an_adult_with_the_terms_accepted_can_be_enrolled(make_client, repos):
    with make_client({"p-1": ENABLED}) as client:
        assert _enroll(client, "p-1").status_code == 201
    assert len(repos["facial"].stored()) == 1


def test_an_adult_pending_the_terms_cannot_be_enrolled(make_client, repos):
    with make_client({"p-1": TERMS_PENDING}) as client:
        response = _enroll(client, "p-1")
    assert response.status_code == 403
    assert "PERSON_NOT_ENABLED" in response.text
    assert "TERMS" in response.text
    assert repos["facial"].stored() == []


def test_a_minor_without_guardian_cannot_be_enrolled(make_client, repos):
    with make_client({"p-1": GUARDIAN_PENDING}) as client:
        response = _enroll(client, "p-1")
    assert response.status_code == 403
    assert "GUARDIAN" in response.text
    assert repos["facial"].stored() == []


def test_a_fully_enabled_minor_is_enrolled_by_the_administrator(make_client, repos):
    with make_client({"p-1": MINOR_ENABLED}) as client:
        assert _enroll(client, "p-1").status_code == 201
    assert len(repos["facial"].stored()) == 1


def test_the_administrator_who_enrolled_the_face_is_in_the_audit_log(make_client, repos):
    with make_client({"p-1": MINOR_ENABLED}) as client:
        assert _enroll(client, "p-1").status_code == 201
    entries = repos["logs"].entries
    enrolled = [entry for entry in entries if entry.operation == "ENROLL"]
    assert len(enrolled) == 1
    assert enrolled[0].actor_user_id == "admin"  # the id the fake session answers for ADMIN
    assert enrolled[0].person_id == "p-1"


def test_fingerprint_enrollment_also_requires_the_enablement(make_client, repos):
    with make_client({"p-1": GUARDIAN_PENDING}) as client:
        response = client.post(
            "/api/v1/biometric/fingerprint/enroll",
            json={"person_id": "p-1", "finger_number": 1, "encoding": [0.2] * 8},
            headers={"Authorization": f"Bearer {ADMIN}"},
        )
    assert response.status_code == 403
    assert repos["fingerprint"].stored() == []


def test_identity_down_fails_closed(make_client, repos):
    with make_client({"p-1": httpx.ConnectError("down")}) as client:
        assert _enroll(client, "p-1").status_code == 503
    assert repos["facial"].stored() == []


def test_an_unexpected_identity_answer_fails_closed(make_client, repos):
    with make_client({"p-1": (500, None)}) as client:
        assert _enroll(client, "p-1").status_code == 503
    assert repos["facial"].stored() == []


def test_a_person_outside_the_scope_is_refused(make_client, repos):
    with make_client({"p-1": (403, None)}) as client:
        assert _enroll(client, "p-1").status_code == 403
    assert repos["facial"].stored() == []


def test_a_minor_cannot_enroll_their_own_face(make_client, repos):
    with make_client({"person-student": MINOR_ENABLED}) as client:
        response = client.post(
            "/api/v1/biometric/facial/enroll-image",
            json={"person_id": "person-student", "image_base64": "AAAA", "challenge_token": "x"},
            headers={"Authorization": f"Bearer {STUDENT}"},
        )
    assert response.status_code == 403
    assert "MINOR_ENROLLMENT_BY_ADMIN_ONLY" in response.text
    assert repos["facial"].stored() == []
