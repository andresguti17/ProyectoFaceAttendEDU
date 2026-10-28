"""Session + RBAC guard on the biometric routers.

The identity/authorization HTTP calls are replaced by an in-process fake, so no
network is needed. Business behaviour is covered in test_router_contract.py
(with the guard disabled); here the guard is switched on.
"""
from __future__ import annotations

from urllib.parse import unquote

import httpx
import pytest
from fastapi.testclient import TestClient

from domain.value_objects.biometric_type import BiometricType
from infrastructure.config.dependencies import (
    get_facial_repository,
    get_match_log_repository,
    get_update_case_repository,
)
from infrastructure.config.settings import get_settings
from infrastructure.web import security
from main import app
from tests.support.in_memory_repositories import (
    InMemoryBiometricRepository,
    InMemoryMatchLogRepository,
    InMemoryUpdateCaseRepository,
)

ADMIN = "11111111-1111-1111-1111-111111111111"
STUDENT = "22222222-2222-2222-2222-222222222222"
CLOSED = "33333333-3333-3333-3333-333333333333"
PERMISSIONS = {
    "admin": {"attendance.record:write", "biometric.case:request", "biometric.case:review"},
    "student": {"biometric.case:request"},
}
# Own person of each caller, for ensure_can_touch_person's identity lookup
# (GET /api/v1/users/{id}, no query string — distinct from the evaluate call below).
OWN_PERSON = {"admin": "person-admin", "student": "person-student"}


async def _fake_get_json(url: str, token: str):
    if "/api/v1/sessions/" in url:
        sessions = {
            ADMIN: {"sessionStatus": "Active", "userId": "admin"},
            STUDENT: {"sessionStatus": "Active", "userId": "student"},
            CLOSED: {"sessionStatus": "Closed", "userId": "admin"},
        }
        session = sessions.get(url.rsplit("/", 1)[1])
        return (200, session) if session else (404, None)
    if "/api/v1/users/" in url and "?" not in url:
        user_id = url.rsplit("/", 1)[1]
        person_id = OWN_PERSON.get(user_id)
        return (200, {"personId": person_id}) if person_id else (404, None)
    user = url.split("userId=")[1].split("&")[0]
    permission = unquote(url.split("permission=")[1])
    return 200, {"allowed": permission in PERMISSIONS[user]}


@pytest.fixture(autouse=True)
def _fresh_auth_cache():
    # Las cachés positivas de sesión/permiso son de proceso: una prueba no debe
    # heredar la sesión que validó otra (p. ej. identity caído debe dar 503).
    security._session_cache.clear()
    security._eval_cache.clear()
    security._caller_school_cache.clear()
    yield
    security._caller_school_cache.clear()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
    monkeypatch.setenv("BIOMETRIC_AUTH_ENABLED", "true")
    get_settings.cache_clear()
    monkeypatch.setattr(security, "_get_json", _fake_get_json)

    app.dependency_overrides[get_facial_repository] = lambda: InMemoryBiometricRepository(BiometricType.FACIAL)
    app.dependency_overrides[get_update_case_repository] = lambda: InMemoryUpdateCaseRepository()
    app.dependency_overrides[get_match_log_repository] = lambda: InMemoryMatchLogRepository()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    get_settings.cache_clear()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_missing_token_is_unauthorized(client):
    response = client.get("/api/v1/biometric/facial/person-1")
    assert response.status_code == 401
    assert response.json()["error"] == "Unauthorized"


def test_malformed_token_is_unauthorized(client):
    assert client.get("/api/v1/biometric/facial/person-1", headers=_auth("abc")).status_code == 401


def test_closed_session_is_unauthorized(client):
    assert client.get("/api/v1/biometric/facial/person-1", headers=_auth(CLOSED)).status_code == 401


def test_health_stays_public(client):
    assert client.get("/health").status_code == 200


def test_student_cannot_read_templates(client):
    response = client.get("/api/v1/biometric/facial/person-1", headers=_auth(STUDENT))
    assert response.status_code == 403
    assert response.json()["error"] == "Forbidden"


def test_admin_passes_the_guard_on_templates(client, monkeypatch):
    # The school scope of the person is checked too: this admin is a Super Administrador.
    async def get_list(url: str, token: str):
        return [{"roleName": "Super Administrador"}] if "/roles" in url else []

    monkeypatch.setattr(security, "_get_list", get_list)
    security._caller_school_cache.clear()
    # 404 = the guard let the request through and the template simply does not exist.
    assert client.get("/api/v1/biometric/facial/person-1", headers=_auth(ADMIN)).status_code == 404


def test_student_can_request_an_update_but_not_review_it(client):
    # Requesting for themselves (ensure_can_touch_person's self-case) —
    # a plain student (no review permission) could not request for anyone else.
    body = {"person_id": OWN_PERSON["student"], "biometric_type": "FACIAL", "reason": "new photo"}
    created = client.post("/api/v1/biometric/update-request", json=body, headers=_auth(STUDENT))
    assert created.status_code == 201
    review = client.patch(
        "/api/v1/biometric/update-request/x/review", json={"status": "Approved"}, headers=_auth(STUDENT)
    )
    assert review.status_code == 403


def test_student_cannot_request_an_update_for_someone_else(client, monkeypatch):
    # Without the review permission, "someone else" is out of reach even when
    # the caller otherwise holds biometric.case:request (every role does).
    # _get_list (roles, academic-actors) isn't faked by the `client` fixture —
    # left unmocked it would hit the real authorization/academic services on
    # the compose network, so it's pinned here to keep the test hermetic.
    async def empty_list(url: str, token: str):
        return []

    monkeypatch.setattr(security, "_get_list", empty_list)
    body = {"person_id": "someone-elses-person", "biometric_type": "FACIAL", "reason": "new photo"}
    response = client.post("/api/v1/biometric/update-request", json=body, headers=_auth(STUDENT))
    assert response.status_code == 403


def test_admin_cannot_request_an_update_for_a_person_in_another_school(client, monkeypatch):
    # Admin is a reviewer, but still confined to their own school — not every
    # school's persons, the exact gap the audit flagged.
    async def get_list(url: str, token: str):
        if "/api/v1/users/admin/roles" in url:
            return [{"roleName": "Administrador"}]
        if "/api/v1/academic-actors?personId=" in url:
            person = url.split("personId=")[1]
            if person == OWN_PERSON["admin"]:
                return [{"academicActorId": 1, "schoolId": 100}]
            return [{"academicActorId": 2, "schoolId": 200}]  # another school
        return []

    monkeypatch.setattr(security, "_get_list", get_list)
    body = {"person_id": "person-other-school", "biometric_type": "FACIAL", "reason": "new photo"}
    response = client.post("/api/v1/biometric/update-request", json=body, headers=_auth(ADMIN))
    assert response.status_code == 403


def test_identity_down_is_service_unavailable(client, monkeypatch):
    async def boom(url: str, token: str):
        raise httpx.ConnectError("identity down")

    monkeypatch.setattr(security, "_get_json", boom)
    assert client.get("/api/v1/biometric/facial/person-1", headers=_auth(ADMIN)).status_code == 503


# ── /enroll-image: self-enrollment and RN-29 re-enrollment ─────────────────

STUDENT_PERSON = "p-student"
ENROLL_BODY = {"person_id": STUDENT_PERSON, "image_base64": "x", "challenge_token": "bad"}


@pytest.fixture
def enroll_client(client, monkeypatch):
    async def get_json(url: str, token: str):
        if "/api/v1/users/" in url:
            return 200, {"personId": STUDENT_PERSON}
        return await _fake_get_json(url, token)

    monkeypatch.setattr(security, "_get_json", get_json)
    repository = InMemoryBiometricRepository(BiometricType.FACIAL)
    app.dependency_overrides[get_facial_repository] = lambda: repository
    client.repository = repository
    return client


def _cases(monkeypatch, cases):
    async def get_list(url: str, token: str):
        return cases

    monkeypatch.setattr(security, "_get_list", get_list)


async def _enroll_existing(repository):
    from domain.entities.facial_embedding import FacialEmbedding

    await repository.enroll(FacialEmbedding(person_id=STUDENT_PERSON, encoding=[0.1, 0.2], model_version="v1"))


def test_student_cannot_enroll_another_person(enroll_client):
    body = {**ENROLL_BODY, "person_id": "someone-else"}
    response = enroll_client.post("/api/v1/biometric/facial/enroll-image", json=body, headers=_auth(STUDENT))
    assert response.status_code == 403


def test_student_first_enrollment_passes_the_guard(enroll_client):
    # 400 = the guard let it through and the (fake) liveness token was rejected.
    response = enroll_client.post("/api/v1/biometric/facial/enroll-image", json=ENROLL_BODY, headers=_auth(STUDENT))
    assert response.status_code == 400


def test_student_reenrollment_needs_an_approved_case(enroll_client, monkeypatch):
    import asyncio

    asyncio.run(_enroll_existing(enroll_client.repository))
    _cases(monkeypatch, [{"updateStatus": "Pending"}])
    response = enroll_client.post("/api/v1/biometric/facial/enroll-image", json=ENROLL_BODY, headers=_auth(STUDENT))
    assert response.status_code == 403


def test_student_reenrollment_with_case_approved_after_template_passes(enroll_client, monkeypatch):
    import asyncio

    asyncio.run(_enroll_existing(enroll_client.repository))
    _cases(monkeypatch, [{"updateStatus": "Approved", "reviewedAt": "2999-01-01T00:00:00Z"}])
    response = enroll_client.post("/api/v1/biometric/facial/enroll-image", json=ENROLL_BODY, headers=_auth(STUDENT))
    assert response.status_code == 400


def test_student_case_approved_before_template_is_spent(enroll_client, monkeypatch):
    import asyncio

    asyncio.run(_enroll_existing(enroll_client.repository))
    _cases(monkeypatch, [{"updateStatus": "Approved", "reviewedAt": "2000-01-01T00:00:00Z"}])
    response = enroll_client.post("/api/v1/biometric/facial/enroll-image", json=ENROLL_BODY, headers=_auth(STUDENT))
    assert response.status_code == 403


def test_student_can_start_liveness(enroll_client):
    assert enroll_client.get("/api/v1/biometric/facial/liveness-challenge", headers=_auth(STUDENT)).status_code == 200
