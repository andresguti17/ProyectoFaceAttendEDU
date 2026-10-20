"""Liveness hardening: supported gestures, minimum step time and same-person checks."""
from __future__ import annotations

import pytest

import infrastructure.web.routers.facial_router as facial_router
from infrastructure.config.settings import get_settings
from infrastructure.web.liveness import LEGACY_ACTIONS, LIVENESS_ACTIONS, create_liveness_challenge
from tests.unit.web.test_facial_image_endpoints import (  # noqa: F401  (fixtures)
    FACIAL_PREFIX,
    FAKE_IMAGE,
    PERSON,
    SECRET,
    client,
    stores,
)

NEW_ACTIONS = {"turn_left", "turn_right", "smile", "nod"}


def _challenge(client, **params):
    return client.get(f"{FACIAL_PREFIX}/liveness-challenge", params={"actions": 2, **params})


def _step(client, token, index=0):
    return client.post(
        f"{FACIAL_PREFIX}/liveness-step",
        json={"challenge_token": token, "action_index": index, "images": [FAKE_IMAGE] * 6},
    )


@pytest.fixture
def passing_gesture(monkeypatch):
    monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
    monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: True)


class TestSupportedGestures:
    def test_clients_that_do_not_announce_support_only_get_the_legacy_gestures(self, client):
        for _ in range(20):
            assert set(_challenge(client).json()["actions"]) <= set(LEGACY_ACTIONS)

    def test_announced_gestures_are_the_only_ones_offered(self, client):
        supported = "smile,nod,turn_left,turn_right"
        for _ in range(20):
            assert set(_challenge(client, supported=supported).json()["actions"]) <= NEW_ACTIONS

    def test_unknown_gestures_are_ignored(self, client):
        response = _challenge(client, supported="blink,wave,smile")
        assert response.status_code == 200
        assert set(response.json()["actions"]) == {"blink", "smile"}

    def test_too_few_supported_gestures_is_rejected(self, client):
        assert _challenge(client, supported="smile").status_code == 422

    def test_every_new_gesture_is_known_to_the_token_module(self):
        assert NEW_ACTIONS <= set(LIVENESS_ACTIONS)
        _, actions = create_liveness_challenge(SECRET, 60, 3, ["smile", "nod", "turn_left"])
        assert set(actions) == {"smile", "nod", "turn_left"}


class TestMinimumStepTime:
    def test_a_step_answered_instantly_is_rejected_and_audited(self, client, monkeypatch, stores, passing_gesture):
        monkeypatch.setenv("BIOMETRIC_LIVENESS_MIN_STEP_SECONDS", "30")
        get_settings.cache_clear()
        token = _challenge(client).json()["challenge_token"]
        response = _step(client, token)
        assert response.status_code == 400
        assert "too fast" in response.json()["message"]
        assert stores["match_logs"].entries[-1].operation == "LIVENESS_FAILURE"


class TestSamePersonAcrossSteps:
    @pytest.fixture(autouse=True)
    def identity_on(self, monkeypatch):
        monkeypatch.setenv("BIOMETRIC_LIVENESS_IDENTITY_CHECK", "true")
        get_settings.cache_clear()

    def _first_step(self, client, monkeypatch, encodings):
        """Do step 0 of a 2-step challenge; `encodings` feed successive face_encoding calls."""
        monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
        monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: True)
        calls = iter(encodings)
        monkeypatch.setattr(facial_router, "face_encoding", lambda image: next(calls))
        token = _challenge(client).json()["challenge_token"]
        first = _step(client, token, 0)
        assert first.status_code == 200
        return first.json()["challenge_token"]

    def _enroll(self, client, token):
        return client.post(
            f"{FACIAL_PREFIX}/enroll-image",
            json={"person_id": PERSON, "image_base64": FAKE_IMAGE, "challenge_token": token},
        )

    def test_the_same_face_passes_every_step_and_the_final_image(self, client, monkeypatch):
        token = self._first_step(client, monkeypatch, [[1.0, 0.0], [1.0, 0.05], [1.0, 0.02]])
        second = _step(client, token, 1)
        assert second.status_code == 200
        assert self._enroll(client, second.json()["challenge_token"]).status_code == 201

    def test_a_different_face_in_a_later_step_is_rejected(self, client, monkeypatch, stores):
        token = self._first_step(client, monkeypatch, [[1.0, 0.0], [0.0, 1.0]])
        response = _step(client, token, 1)
        assert response.status_code == 400
        assert "changed" in response.json()["message"]
        assert stores["match_logs"].entries[-1].operation == "LIVENESS_FAILURE"

    def test_a_different_face_in_the_final_image_is_rejected(self, client, monkeypatch):
        token = self._first_step(client, monkeypatch, [[1.0, 0.0], [1.0, 0.0], [0.0, 1.0]])
        second = _step(client, token, 1)
        assert second.status_code == 200
        final = self._enroll(client, second.json()["challenge_token"])
        assert final.status_code == 400
        assert "changed" in final.json()["message"]
