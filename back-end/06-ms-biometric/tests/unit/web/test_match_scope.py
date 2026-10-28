"""A 1:N search or a 1:1 verification must not cross schools.

Before, an Instructor of one school could identify a face of another school and get its
person_id, and verify against any person_id. Now the answer for a person of another school is the
same "no match" / "no template" as for someone never enrolled. Auth is on and identity,
authorization and academic are in-process fakes (same approach as test_person_scope.py).
"""
from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient

import infrastructure.config.dependencies as dependencies
from domain.entities.facial_embedding import FacialEmbedding
from domain.entities.fingerprint_embedding import FingerprintEmbedding
from domain.value_objects.biometric_type import BiometricType
from infrastructure.config.dependencies import (
    get_facial_repository,
    get_facial_repository_ws,
    get_fingerprint_repository,
    get_fingerprint_repository_ws,
    get_match_log_repository,
    get_match_log_repository_ws,
)
from infrastructure.config.settings import get_settings
from infrastructure.web import match_scope, security
from infrastructure.web.match_scope import MatchScope, best_allowed
from infrastructure.web.routers import fingerprint_router
from main import app
from tests.support import school_auth
from tests.support.in_memory_repositories import InMemoryBiometricRepository, InMemoryMatchLogRepository
from tests.support.school_auth import ADMIN_A, ADMIN_B, NO_ACTOR, SUPER_ADMIN

FACE_A = [1.0, 0.0, 0.0, 0.0]
FACE_B = [0.0, 1.0, 0.0, 0.0]
FACE_A2 = [0.9, 0.3, 0.0, 0.0]  # similar to FACE_A, still well above the match threshold against it


@pytest.fixture
def stores():
    facial = InMemoryBiometricRepository(BiometricType.FACIAL)
    fingerprint = InMemoryBiometricRepository(BiometricType.FINGERPRINT)

    async def seed():
        for person, face in (("person-in-a", FACE_A), ("person-in-b", FACE_B)):
            await facial.enroll(FacialEmbedding(person_id=person, encoding=face, model_version="m1"))
            await fingerprint.enroll(
                FingerprintEmbedding(person_id=person, finger_number=2, encoding=face, model_version="m1")
            )
        # raw-sample records (matched by keypoints): the stored "image" is the sample text itself
        for person, sample in (("person-in-a", "SAMPLE-A"), ("person-in-b", "SAMPLE-B")):
            await fingerprint.enroll(
                FingerprintEmbedding(
                    person_id=person, finger_number=3, encoding=[], model_version="m1",
                    raw_sample_b64=sample, sample_format=1,
                )
            )

    asyncio.run(seed())
    return {"facial": facial, "fingerprint": fingerprint}


@pytest.fixture
def client(monkeypatch, stores):
    monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
    monkeypatch.setenv("BIOMETRIC_AUTH_ENABLED", "true")
    dependencies._rate_limiters.clear()
    get_settings.cache_clear()
    school_auth.install(monkeypatch)
    monkeypatch.setattr(fingerprint_router, "decode_fingerprint", lambda data, max_bytes, max_pixels: data)
    monkeypatch.setattr(
        fingerprint_router, "fingerprint_keypoint_score", lambda query, stored: 900 if query == stored else 0
    )
    for dep in (get_facial_repository, get_facial_repository_ws):
        app.dependency_overrides[dep] = lambda: stores["facial"]
    for dep in (get_fingerprint_repository, get_fingerprint_repository_ws):
        app.dependency_overrides[dep] = lambda: stores["fingerprint"]
    for dep in (get_match_log_repository, get_match_log_repository_ws):
        app.dependency_overrides[dep] = lambda: InMemoryMatchLogRepository()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    get_settings.cache_clear()


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


FACIAL = "/api/v1/biometric/facial"
FINGERPRINT = "/api/v1/biometric/fingerprint"


class TestFaceIdentify:
    def test_a_face_of_the_callers_school_is_identified(self, client):
        response = client.post(f"{FACIAL}/identify", json={"encoding": FACE_A}, headers=_auth(ADMIN_A))
        assert response.status_code == 200
        assert response.json()["person_id"] == "person-in-a"

    def test_a_face_of_another_school_is_no_match_and_reveals_nothing(self, client):
        response = client.post(f"{FACIAL}/identify", json={"encoding": FACE_B}, headers=_auth(ADMIN_A))
        assert response.status_code == 404
        assert "person-in-b" not in response.text
        # the very same answer as for a face that was never enrolled
        unknown = client.post(f"{FACIAL}/identify", json={"encoding": [0.0, 0.0, 1.0, 0.0]}, headers=_auth(ADMIN_A))
        assert unknown.status_code == 404 and unknown.json()["message"] == response.json()["message"]

    def test_each_school_identifies_its_own(self, client):
        assert client.post(f"{FACIAL}/identify", json={"encoding": FACE_B}, headers=_auth(ADMIN_B)).json()["person_id"] == "person-in-b"
        assert client.post(f"{FACIAL}/identify", json={"encoding": FACE_A}, headers=_auth(ADMIN_B)).status_code == 404

    def test_the_super_administrador_identifies_every_school(self, client):
        for face, person in ((FACE_A, "person-in-a"), (FACE_B, "person-in-b")):
            body = client.post(f"{FACIAL}/identify", json={"encoding": face}, headers=_auth(SUPER_ADMIN)).json()
            assert body["person_id"] == person

    def test_a_caller_without_an_academic_actor_matches_nobody(self, client):
        assert client.post(f"{FACIAL}/identify", json={"encoding": FACE_A}, headers=_auth(NO_ACTOR)).status_code == 404

    def test_a_better_match_in_another_school_does_not_hide_the_one_in_the_callers_school(self, client, stores):
        asyncio.run(stores["facial"].enroll(FacialEmbedding(person_id="person-in-a2", encoding=FACE_A2, model_version="m1")))
        # FACE_B's school-B person scores 1.0 against FACE_B; the school-A look-alike still clears the threshold
        body = client.post(f"{FACIAL}/identify", json={"encoding": [0.95, 0.15, 0.0, 0.0]}, headers=_auth(ADMIN_A))
        assert body.status_code == 200
        assert body.json()["person_id"] in {"person-in-a", "person-in-a2"}


class TestFaceVerify:
    def test_verifying_a_person_of_the_callers_school(self, client):
        response = client.post(f"{FACIAL}/verify", json={"person_id": "person-in-a", "encoding": FACE_A}, headers=_auth(ADMIN_A))
        assert response.status_code == 200 and response.json()["match"] is True

    def test_verifying_a_person_of_another_school_is_a_404_like_any_unknown_person(self, client):
        foreign = client.post(f"{FACIAL}/verify", json={"person_id": "person-in-b", "encoding": FACE_B}, headers=_auth(ADMIN_A))
        unknown = client.post(f"{FACIAL}/verify", json={"person_id": "person-nobody", "encoding": FACE_B}, headers=_auth(SUPER_ADMIN))
        assert foreign.status_code == 404
        assert foreign.json()["message"] == unknown.json()["message"]


class TestFingerprint:
    def test_vector_identify_is_limited_to_the_callers_school(self, client):
        mine = client.post(f"{FINGERPRINT}/identify", json={"encoding": FACE_A, "finger_number": 2}, headers=_auth(ADMIN_A))
        assert mine.status_code == 200 and mine.json()["person_id"] == "person-in-a"
        foreign = client.post(f"{FINGERPRINT}/identify", json={"encoding": FACE_B, "finger_number": 2}, headers=_auth(ADMIN_A))
        assert foreign.status_code == 404 and "person-in-b" not in foreign.text

    def test_raw_sample_identify_is_limited_to_the_callers_school(self, client):
        mine = client.post(f"{FINGERPRINT}/identify-sample", json={"data_base64": "SAMPLE-A", "finger_number": 3}, headers=_auth(ADMIN_A))
        assert mine.status_code == 200 and mine.json()["person_id"] == "person-in-a"
        foreign = client.post(f"{FINGERPRINT}/identify-sample", json={"data_base64": "SAMPLE-B", "finger_number": 3}, headers=_auth(ADMIN_A))
        assert foreign.status_code == 404 and "person-in-b" not in foreign.text
        assert client.post(
            f"{FINGERPRINT}/identify-sample", json={"data_base64": "SAMPLE-B", "finger_number": 3}, headers=_auth(SUPER_ADMIN)
        ).json()["person_id"] == "person-in-b"

    def test_verifying_another_schools_person_is_a_404(self, client):
        body = {"person_id": "person-in-b", "finger_number": 2, "encoding": FACE_B}
        assert client.post(f"{FINGERPRINT}/verify", json=body, headers=_auth(ADMIN_A)).status_code == 404
        assert client.post(f"{FINGERPRINT}/verify", json=body, headers=_auth(ADMIN_B)).status_code == 200


class TestWebSocketChannel:
    """The channel calls the same handlers directly, so the connection's scope must reach them."""

    @staticmethod
    def _connect(client, token):
        return client.websocket_connect("/api/v1/biometric/ws", subprotocols=[security.WS_BEARER_PROTOCOL, token])

    _ids = iter(range(1000))

    @classmethod
    def _identify(cls, ws, face):
        # a fresh id per frame: a repeated client_message_id is answered from the idempotency cache
        ws.send_text('{"type": "facial.identify", "client_message_id": "m%d", "payload": {"encoding": %s}}' % (next(cls._ids), face))
        return ws.receive_json()

    def test_identify_over_the_socket_stays_in_the_school(self, client):
        with self._connect(client, ADMIN_A) as ws:
            ok = self._identify(ws, FACE_A)
            assert ok["type"] == "facial.identify.ack" and ok["result"]["person_id"] == "person-in-a"
        with self._connect(client, ADMIN_A) as ws:
            foreign = self._identify(ws, FACE_B)
            assert foreign["type"] == "error" and foreign["error"] == "NotFound"
            assert "person-in-b" not in str(foreign)

    def test_verify_over_the_socket_stays_in_the_school(self, client):
        with self._connect(client, ADMIN_A) as ws:
            ws.send_text('{"type": "facial.verify", "payload": {"person_id": "person-in-b", "encoding": %s}}' % FACE_B)
            assert ws.receive_json()["type"] == "error"

    def test_the_super_administrador_identifies_everyone_over_the_socket(self, client):
        with self._connect(client, SUPER_ADMIN) as ws:
            assert self._identify(ws, FACE_B)["result"]["person_id"] == "person-in-b"


class _Candidate:
    def __init__(self, person_id):
        self.person_id = person_id


class TestMatchScopeUnits:
    def _scope(self, monkeypatch, schools, school_id="100", token="t"):
        calls = []

        async def resolve(person_id, tok):
            calls.append(person_id)
            return schools.get(person_id)

        monkeypatch.setattr(security, "resolve_person_school", resolve)
        match_scope._match_allow_cache.clear()
        return MatchScope(False, school_id, token), calls

    def test_the_best_candidate_the_caller_may_see_wins_even_if_it_is_not_the_top_score(self, monkeypatch):
        scope, _ = self._scope(monkeypatch, {"far": "200", "near": "100"})
        scored = [(0.9, _Candidate("far")), (0.7, _Candidate("near")), (0.2, _Candidate("low"))]
        best, score = asyncio.run(best_allowed(scored, 0.5, scope))
        assert best.person_id == "near" and score == 0.7

    def test_nothing_qualifying_returns_no_candidate_and_the_raw_best_score_for_the_audit_log(self, monkeypatch):
        scope, calls = self._scope(monkeypatch, {"far": "200"})
        best, score = asyncio.run(best_allowed([(0.9, _Candidate("far")), (0.1, _Candidate("low"))], 0.5, scope))
        assert best is None and score == 0.9
        assert calls == ["far"]  # the candidate below the threshold was never looked up

    def test_the_school_lookup_is_bounded_and_cached(self, monkeypatch):
        schools = {f"p{i}": "200" for i in range(20)}
        scope, calls = self._scope(monkeypatch, schools)
        scored = [(0.9 - i * 0.01, _Candidate(f"p{i}")) for i in range(20)]
        assert asyncio.run(best_allowed(scored, 0.5, scope))[0] is None
        assert len(calls) == match_scope.MAX_CANDIDATES
        asyncio.run(best_allowed(scored, 0.5, scope))
        assert len(calls) == match_scope.MAX_CANDIDATES  # second pass answered from the cache

    def test_unrestricted_and_incomplete_scopes(self, monkeypatch):
        assert asyncio.run(match_scope.UNRESTRICTED.allows("anyone")) is True
        assert asyncio.run(MatchScope(False, None, "t").allows("anyone")) is False  # no academic actor
        assert asyncio.run(MatchScope(False, "100", None).allows("anyone")) is False  # no token
