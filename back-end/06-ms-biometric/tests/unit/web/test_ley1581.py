"""Ley 1581 de 2012 in the biometric service.

- Biometric data are stored encrypted (art. 4-g): the vector and the raw sample
  never reach MongoDB in clear, and a ciphertext moved to another document fails.
- No template is stored without the holder's biometric authorization (arts. 6-a, 9).
- Revocation deletes every template and unlinks the match logs (art. 8-e).
"""
from __future__ import annotations

import base64
import os
from datetime import datetime, timezone
from urllib.parse import unquote

import httpx
import pytest
from fastapi.testclient import TestClient

from domain.entities.facial_embedding import FacialEmbedding
from domain.entities.fingerprint_embedding import FingerprintEmbedding
from domain.entities.match_log import BiometricMatchLog
from domain.value_objects.biometric_type import BiometricType
from infrastructure.config.dependencies import (
    get_facial_repository,
    get_fingerprint_repository,
    get_match_log_repository,
)
from infrastructure.config.settings import get_settings
from infrastructure.persistence.document_mappers import document_to_embedding, embedding_to_document
from infrastructure.security.biometric_cipher import BiometricCipher
from infrastructure.web import security
from main import app
from tests.support.in_memory_repositories import InMemoryBiometricRepository, InMemoryMatchLogRepository

KEY = base64.b64encode(bytes(range(32))).decode()
ADMIN = "11111111-1111-1111-1111-111111111111"
STUDENT = "22222222-2222-2222-2222-222222222222"
PERMISSIONS = {
    "admin": {"attendance.record:write", "biometric.case:request", "biometric.case:review"},
    "student": {"biometric.case:request"},
}
OWN_PERSON = {"admin": "person-admin", "student": "person-student"}


# ── encryption at rest ─────────────────────────────────────────────────────
def test_cipher_round_trip_and_binding_to_the_document():
    cipher = BiometricCipher(KEY)
    values = [0.125, -0.5, 1e-3]
    sealed = cipher.encrypt_floats(values, "doc-1")

    assert sealed.startswith("enc:v1:")
    assert cipher.decrypt_floats(sealed, "doc-1") == values
    assert cipher.encrypt_floats(values, "doc-1") != sealed  # random nonce
    with pytest.raises(ValueError):
        cipher.decrypt_floats(sealed, "doc-2")  # copied onto another document
    with pytest.raises(ValueError):
        BiometricCipher(base64.b64encode(bytes(32)).decode()).decrypt_floats(sealed, "doc-1")


def test_cipher_requires_a_32_byte_key():
    with pytest.raises(RuntimeError):
        BiometricCipher("")
    with pytest.raises(RuntimeError):
        BiometricCipher(base64.b64encode(bytes(16)).decode())


def test_documents_hold_no_biometric_data_in_clear():
    face = FacialEmbedding(person_id="p-1", encoding=[0.1] * 128, model_version="dlib")
    document = embedding_to_document(face)

    assert isinstance(document["encoding"], str) and document["encoding"].startswith("enc:v1:")
    assert "0.1" not in document["encoding"]
    restored = document_to_embedding(document, BiometricType.FACIAL)
    assert restored.encoding == pytest.approx([0.1] * 128)

    finger = FingerprintEmbedding(
        person_id="p-1", finger_number=1, encoding=[], model_version="sift",
        raw_sample_b64="AAECAwQ=", sample_format=1,
    )
    finger_doc = embedding_to_document(finger)
    assert finger_doc["raw_sample_b64"].startswith("enc:v1:")
    assert document_to_embedding(finger_doc, BiometricType.FINGERPRINT).raw_sample_b64 == "AAECAwQ="


def test_legacy_plain_documents_are_still_readable():
    legacy = {"_id": "old-1", "person_id": "p-9", "encoding": [0.2, 0.3], "model_version": "dlib"}
    assert document_to_embedding(legacy, BiometricType.FACIAL).encoding == [0.2, 0.3]


# ── consent and deletion through the API ───────────────────────────────────
def _make_fake(consents: dict[str, object]):
    async def fake_get_json(url: str, token: str):
        if "/api/v1/sessions/" in url:
            user = {ADMIN: "admin", STUDENT: "student"}.get(url.rsplit("/", 1)[1])
            return (200, {"sessionStatus": "Active", "userId": user}) if user else (404, None)
        if url.endswith("/consent"):
            person = url.split("/persons/")[1].split("/")[0]
            answer = consents.get(person)
            if isinstance(answer, Exception):
                raise answer
            return answer if isinstance(answer, tuple) else (200, {"biometricAuthorized": bool(answer)})
        if "/api/v1/users/" in url and "?" not in url:
            person_id = OWN_PERSON.get(url.rsplit("/", 1)[1])
            return (200, {"personId": person_id}) if person_id else (404, None)
        if "/academic-actors" in url:
            return 200, {"schoolId": "school-1"}
        user = url.split("userId=")[1].split("&")[0]
        permission = unquote(url.split("permission=")[1])
        return 200, {"allowed": permission in PERMISSIONS[user]}

    return fake_get_json


async def _fake_get_list(url: str, token: str) -> list:
    # Roles (authorization) and academic actors: the apprentice is in school-1, without review rights.
    if "/roles" in url:
        return [{"roleName": "Administrador" if "/users/admin/" in url else "Aprendiz"}]
    if "/academic-actors" in url:
        return [{"schoolId": "school-1"}]
    return []


@pytest.fixture
def repos():
    return {
        "facial": InMemoryBiometricRepository(BiometricType.FACIAL),
        "fingerprint": InMemoryBiometricRepository(BiometricType.FINGERPRINT),
        "logs": InMemoryMatchLogRepository(),
    }


@pytest.fixture
def make_client(monkeypatch, repos):
    def build(consents):
        monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
        monkeypatch.setenv("BIOMETRIC_AUTH_ENABLED", "true")
        monkeypatch.setenv("BIOMETRIC_CONSENT_CHECK_ENABLED", "true")
        get_settings.cache_clear()
        security._session_cache.clear()
        security._eval_cache.clear()
        security._caller_school_cache.clear()
        monkeypatch.setattr(security, "_get_json", _make_fake(consents))
        monkeypatch.setattr(security, "_get_list", _fake_get_list)
        app.dependency_overrides[get_facial_repository] = lambda: repos["facial"]
        app.dependency_overrides[get_fingerprint_repository] = lambda: repos["fingerprint"]
        app.dependency_overrides[get_match_log_repository] = lambda: repos["logs"]
        return TestClient(app)

    yield build
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def _enroll(client, person_id):
    return client.post(
        "/api/v1/biometric/facial/enroll",
        json={"person_id": person_id, "encoding": [0.01] * 128},
        headers={"Authorization": f"Bearer {ADMIN}"},
    )


def test_enrollment_without_biometric_authorization_is_refused_with_428(make_client, repos):
    with make_client({"p-1": False}) as client:
        response = _enroll(client, "p-1")
    assert response.status_code == 428
    assert "BIOMETRIC_CONSENT_REQUIRED" in response.text
    assert repos["facial"].stored() == []


def test_enrollment_with_biometric_authorization_is_stored(make_client, repos):
    with make_client({"p-1": True}) as client:
        assert _enroll(client, "p-1").status_code == 201
    assert len(repos["facial"].stored()) == 1


def test_identity_down_fails_closed(make_client, repos):
    with make_client({"p-1": httpx.ConnectError("down")}) as client:
        assert _enroll(client, "p-1").status_code == 503
    assert repos["facial"].stored() == []


@pytest.mark.asyncio
async def test_the_holder_deletes_all_their_biometric_data(make_client, repos):
    await repos["facial"].enroll(FacialEmbedding(person_id="person-student", encoding=[0.1] * 128, model_version="m"))
    await repos["facial"].enroll(FacialEmbedding(person_id="person-student", encoding=[0.2] * 128, model_version="m"))
    await repos["fingerprint"].enroll(
        FingerprintEmbedding(person_id="person-student", finger_number=2, encoding=[0.3], model_version="m")
    )
    await repos["facial"].enroll(FacialEmbedding(person_id="someone-else", encoding=[0.4] * 128, model_version="m"))
    await repos["logs"].record(BiometricMatchLog(
        person_id="person-student", matched_person_id="person-student", biometric_type=BiometricType.FACIAL,
        operation="identify", matched=True, score=0.9, threshold=0.5, created_at=datetime.now(timezone.utc),
    ))

    with make_client({}) as client:
        response = client.delete(
            "/api/v1/biometric/persons/person-student", headers={"Authorization": f"Bearer {STUDENT}"}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["deleted_face_templates"] == 2
    assert body["deleted_fingerprint_templates"] == 1
    assert [t.person_id for t in repos["facial"].stored()] == ["someone-else"]
    assert repos["fingerprint"].stored() == []
    assert repos["logs"].entries[0].person_id is None and repos["logs"].entries[0].matched_person_id is None


def test_an_apprentice_cannot_delete_someone_elses_data(make_client):
    with make_client({}) as client:
        response = client.delete(
            "/api/v1/biometric/persons/person-admin", headers={"Authorization": f"Bearer {STUDENT}"}
        )
    assert response.status_code == 403
