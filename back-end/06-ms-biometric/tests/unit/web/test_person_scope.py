"""Staff routes addressed by person_id stay inside the caller's school.

Before, any Instructor or Administrador could read, list and erase the templates of a person
in another school, and the responses carried the decrypted vector. Auth is switched on and
identity/authorization/academic are in-process fakes (same approach as test_security.py).
"""
from __future__ import annotations

import asyncio
from urllib.parse import unquote

import pytest
from fastapi.testclient import TestClient

from domain.entities.facial_embedding import FacialEmbedding
from domain.entities.fingerprint_embedding import FingerprintEmbedding
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

ADMIN_A = "aaaaaaaa-0000-4000-8000-00000000000a"
ADMIN_B = "bbbbbbbb-0000-4000-8000-00000000000a"
SUPER_ADMIN = "cccccccc-0000-4000-8000-00000000000a"
NO_ACTOR = "dddddddd-0000-4000-8000-00000000000a"
_USERS = {  # session token -> (user id, own person id, roles)
    ADMIN_A: ("user-a", "person-admin-a", ["Administrador"]),
    ADMIN_B: ("user-b", "person-admin-b", ["Administrador"]),
    SUPER_ADMIN: ("user-sa", "person-sa", ["Super Administrador"]),
    NO_ACTOR: ("user-na", "person-na", ["Administrador"]),
}
_PERSON_SCHOOL = {"person-admin-a": 100, "person-admin-b": 200, "person-in-a": 100, "person-in-b": 200}
VECTOR = [0.125, 0.5, 0.25, 0.0625]


async def _get_json(url: str, token: str):
    if "/api/v1/sessions/" in url:
        user = _USERS.get(url.rsplit("/", 1)[1])
        return (200, {"sessionStatus": "Active", "userId": user[0]}) if user else (404, None)
    if "/auth/evaluate" in url:
        return 200, {"allowed": True}  # every caller holds the staff permission
    user_id = url.rsplit("/", 1)[1]  # identity: GET /api/v1/users/{id}
    person = next((u[1] for u in _USERS.values() if u[0] == user_id), None)
    return (200, {"personId": person}) if person else (404, None)


async def _get_list(url: str, token: str):
    if "/roles" in url:
        user_id = url.split("/users/")[1].split("/")[0]
        return [{"roleName": r} for u in _USERS.values() if u[0] == user_id for r in u[2]]
    if "/academic-actors?personId=" in url:
        school = _PERSON_SCHOOL.get(unquote(url.split("personId=")[1]))
        return [{"academicActorId": 1, "schoolId": school}] if school else []
    return []


@pytest.fixture
def stores():
    facial = InMemoryBiometricRepository(BiometricType.FACIAL)
    fingerprint = InMemoryBiometricRepository(BiometricType.FINGERPRINT)

    async def seed():
        for person in ("person-in-a", "person-in-b"):
            await facial.enroll(FacialEmbedding(person_id=person, encoding=VECTOR, model_version="m1"))
            await fingerprint.enroll(
                FingerprintEmbedding(person_id=person, finger_number=2, encoding=VECTOR, model_version="m1")
            )

    asyncio.run(seed())
    return {"facial": facial, "fingerprint": fingerprint}


@pytest.fixture
def client(monkeypatch, stores):
    monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
    monkeypatch.setenv("BIOMETRIC_AUTH_ENABLED", "true")
    get_settings.cache_clear()
    security._session_cache.clear()
    security._eval_cache.clear()
    security._caller_school_cache.clear()
    monkeypatch.setattr(security, "_get_json", _get_json)
    monkeypatch.setattr(security, "_get_list", _get_list)
    app.dependency_overrides[get_facial_repository] = lambda: stores["facial"]
    app.dependency_overrides[get_fingerprint_repository] = lambda: stores["fingerprint"]
    app.dependency_overrides[get_match_log_repository] = lambda: InMemoryMatchLogRepository()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    get_settings.cache_clear()
    security._caller_school_cache.clear()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


FACIAL = "/api/v1/biometric/facial"
FINGERPRINT = "/api/v1/biometric/fingerprint"
SUMMARY = "/api/v1/biometric"


class TestAnotherSchoolIsOffLimits:
    def test_facial_read_history_and_delete_are_403(self, client, stores):
        assert client.get(f"{FACIAL}/person-in-b", headers=_auth(ADMIN_A)).status_code == 403
        assert client.get(f"{FACIAL}/person-in-b/history", headers=_auth(ADMIN_A)).status_code == 403
        assert client.delete(f"{FACIAL}/person-in-b", headers=_auth(ADMIN_A)).status_code == 403
        # the template is still there: the refused DELETE erased nothing
        assert asyncio.run(stores["facial"].find_active("person-in-b")) is not None

    def test_fingerprint_list_read_and_delete_are_403(self, client, stores):
        assert client.get(f"{FINGERPRINT}/person-in-b", headers=_auth(ADMIN_A)).status_code == 403
        assert client.get(f"{FINGERPRINT}/person-in-b/2", headers=_auth(ADMIN_A)).status_code == 403
        assert client.delete(f"{FINGERPRINT}/person-in-b/2", headers=_auth(ADMIN_A)).status_code == 403
        assert asyncio.run(stores["fingerprint"].find_active("person-in-b", 2)) is not None

    def test_summary_of_a_person_of_another_school_is_403(self, client):
        assert client.get(f"{SUMMARY}/person-in-b/summary", headers=_auth(ADMIN_A)).status_code == 403

    def test_a_caller_without_an_academic_actor_gets_nothing(self, client):
        assert client.get(f"{FACIAL}/person-in-a", headers=_auth(NO_ACTOR)).status_code == 403
        assert client.delete(f"{FACIAL}/person-in-a", headers=_auth(NO_ACTOR)).status_code == 403


class TestOwnSchoolAndSuperAdministrador:
    def test_a_school_administrador_reaches_its_own_people(self, client):
        assert client.get(f"{FACIAL}/person-in-a", headers=_auth(ADMIN_A)).status_code == 200
        assert client.get(f"{FACIAL}/person-in-a/history", headers=_auth(ADMIN_A)).status_code == 200
        assert client.get(f"{FINGERPRINT}/person-in-a", headers=_auth(ADMIN_A)).status_code == 200
        assert client.get(f"{FINGERPRINT}/person-in-a/2", headers=_auth(ADMIN_A)).status_code == 200
        assert client.get(f"{SUMMARY}/person-in-a/summary", headers=_auth(ADMIN_A)).json()["has_face"] is True

    def test_a_school_administrador_can_delete_within_its_school(self, client, stores):
        assert client.delete(f"{FACIAL}/person-in-a", headers=_auth(ADMIN_A)).status_code == 204
        assert client.delete(f"{FINGERPRINT}/person-in-a/2", headers=_auth(ADMIN_A)).status_code == 204
        assert asyncio.run(stores["facial"].find_active("person-in-a")) is None
        assert asyncio.run(stores["facial"].find_active("person-in-b")) is not None

    def test_the_super_administrador_reaches_every_school(self, client):
        for person in ("person-in-a", "person-in-b"):
            assert client.get(f"{FACIAL}/{person}", headers=_auth(SUPER_ADMIN)).status_code == 200
            assert client.get(f"{FINGERPRINT}/{person}/2", headers=_auth(SUPER_ADMIN)).status_code == 200


class TestTheBiometricItselfNeverLeavesThroughTheApi:
    def test_reads_return_metadata_without_the_vector(self, client):
        for path in (
            f"{FACIAL}/person-in-a",
            f"{FINGERPRINT}/person-in-a/2",
        ):
            body = client.get(path, headers=_auth(SUPER_ADMIN)).json()
            assert body["person_id"] == "person-in-a"
            assert body["template_version"] == 1
            assert "encoding" not in body and "raw_sample_b64" not in body

    def test_lists_and_history_carry_no_vectors_either(self, client):
        history = client.get(f"{FACIAL}/person-in-a/history", headers=_auth(SUPER_ADMIN)).json()["history"]
        templates = client.get(f"{FINGERPRINT}/person-in-a", headers=_auth(SUPER_ADMIN)).json()["templates"]
        assert history and templates
        for item in history + templates:
            assert "encoding" not in item and "raw_sample_b64" not in item
        assert str(VECTOR[0]) not in client.get(f"{FACIAL}/person-in-a", headers=_auth(SUPER_ADMIN)).text
