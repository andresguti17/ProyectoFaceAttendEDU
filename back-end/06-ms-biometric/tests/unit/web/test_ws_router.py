"""Biometric WebSocket channel tests.

Reuses the in-memory doubles from `test_router_contract.py` (same business
rules, no database) and the session+RBAC fake from `test_security.py` (same
auth rule, no network), so these tests exercise the exact contracts the REST
suite already pins — just over `/api/v1/biometric/ws` instead of HTTP.
"""
from __future__ import annotations

import json
from urllib.parse import unquote

import pytest
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient

import infrastructure.config.dependencies as dependencies
import infrastructure.web.routers.facial_router as facial_router
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
from infrastructure.web import security
from infrastructure.web.routers import ws_router
from main import app
from tests.support.in_memory_repositories import (
    InMemoryBiometricRepository,
    InMemoryMatchLogRepository,
)

PERSON = "550e8400-e29b-41d4-a716-446655440000"
UNIT_VECTOR = [1.0, 0.0, 0.0, 0.0]

WS_PATH = "/api/v1/biometric/ws"
FACIAL_PREFIX = "/api/v1/biometric/facial"
FAKE_IMAGE = "aGVsbG8="  # never decoded: decode_image is monkeypatched in these tests
LIVENESS_SECRET = "test-liveness-secret"

ADMIN = "11111111-1111-1111-1111-111111111111"
STUDENT = "22222222-2222-2222-2222-222222222222"
_PERMISSIONS = {"admin": {"attendance.record:write"}, "student": set()}


def _send(ws, message_type, payload=None, client_message_id=None, direction=None):
    body = {"type": message_type, "payload": payload or {}}
    if client_message_id is not None:
        body["client_message_id"] = client_message_id
    if direction is not None:
        body["direction"] = direction
    ws.send_text(json.dumps(body))


async def _fake_get_json(url: str, token: str):
    if "/api/v1/sessions/" in url:
        sessions = {
            ADMIN: {"sessionStatus": "Active", "userId": "admin"},
            STUDENT: {"sessionStatus": "Active", "userId": "student"},
        }
        session = sessions.get(url.rsplit("/", 1)[1])
        return (200, session) if session else (404, None)
    user = url.split("userId=")[1].split("&")[0]
    permission = unquote(url.split("permission=")[1])
    return 200, {"allowed": permission in _PERMISSIONS[user]}


@pytest.fixture
def stores():
    return {
        "facial": InMemoryBiometricRepository(BiometricType.FACIAL),
        "fingerprint": InMemoryBiometricRepository(BiometricType.FINGERPRINT),
        "match_logs": InMemoryMatchLogRepository(),
    }


@pytest.fixture
def client(monkeypatch, stores):
    """Auth disabled. REST and WS dependencies point at the *same* stores, so
    a test can prove both channels run the same business layer on the same
    data (`TestRestAndWebSocketCoexistence`)."""
    monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
    monkeypatch.setenv("BIOMETRIC_LIVENESS_CHALLENGE_SECRET", LIVENESS_SECRET)
    dependencies._rate_limiters.clear()
    get_settings.cache_clear()

    app.dependency_overrides[get_facial_repository] = lambda: stores["facial"]
    app.dependency_overrides[get_fingerprint_repository] = lambda: stores["fingerprint"]
    app.dependency_overrides[get_match_log_repository] = lambda: stores["match_logs"]
    app.dependency_overrides[get_facial_repository_ws] = lambda: stores["facial"]
    app.dependency_overrides[get_fingerprint_repository_ws] = lambda: stores["fingerprint"]
    app.dependency_overrides[get_match_log_repository_ws] = lambda: stores["match_logs"]

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    get_settings.cache_clear()


@pytest.fixture
def auth_client(monkeypatch, stores):
    monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
    monkeypatch.setenv("BIOMETRIC_AUTH_ENABLED", "true")
    get_settings.cache_clear()
    monkeypatch.setattr(security, "_get_json", _fake_get_json)

    app.dependency_overrides[get_facial_repository_ws] = lambda: stores["facial"]
    app.dependency_overrides[get_fingerprint_repository_ws] = lambda: stores["fingerprint"]
    app.dependency_overrides[get_match_log_repository_ws] = lambda: stores["match_logs"]

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    get_settings.cache_clear()


class TestFacialOverWebSocket:
    def test_enroll_ack_matches_the_rest_response_shape(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(
                ws,
                ws_router.FACIAL_ENROLL,
                {"person_id": PERSON, "encoding": UNIT_VECTOR, "model_version": "facenet-v1"},
                client_message_id="m1",
            )
            ack = ws.receive_json()

        assert ack["type"] == f"{ws_router.FACIAL_ENROLL}.ack"
        assert ack["client_message_id"] == "m1"
        result = ack["result"]
        assert result["person_id"] == PERSON
        assert result["template_version"] == 1
        assert result["is_active"] is True

    def test_identify_matches_a_previously_enrolled_template(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, ws_router.FACIAL_ENROLL, {"person_id": PERSON, "encoding": UNIT_VECTOR})
            ws.receive_json()

            _send(ws, ws_router.FACIAL_IDENTIFY, {"encoding": UNIT_VECTOR}, client_message_id="m2")
            ack = ws.receive_json()

        assert ack["result"]["person_id"] == PERSON
        assert ack["result"]["score"] == pytest.approx(1.0)

    def test_identify_without_a_match_returns_an_error_frame_not_a_disconnect(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, ws_router.FACIAL_IDENTIFY, {"encoding": UNIT_VECTOR}, client_message_id="m1")
            error = ws.receive_json()
            assert error["type"] == "error"
            assert error["error"] == "NotFound"

            # the connection must still be usable afterwards
            _send(ws, ws_router.PING)
            pong = ws.receive_json()
            assert pong["type"] == "pong"


class TestFingerprintOverWebSocket:
    def test_enroll_without_a_finger_number_is_a_bad_request(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, ws_router.FINGERPRINT_ENROLL, {"person_id": PERSON, "encoding": UNIT_VECTOR})
            error = ws.receive_json()

        assert error["type"] == "error"
        assert error["error"] == "BadRequest"

    def test_enroll_and_identify_round_trip(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(
                ws,
                ws_router.FINGERPRINT_ENROLL,
                {"person_id": PERSON, "finger_number": 3, "encoding": UNIT_VECTOR},
            )
            enrolled = ws.receive_json()["result"]
            assert enrolled["finger_number"] == 3

            _send(
                ws,
                ws_router.FINGERPRINT_IDENTIFY,
                {"encoding": UNIT_VECTOR, "finger_number": 3},
            )
            identified = ws.receive_json()["result"]

        assert identified["person_id"] == PERSON
        assert identified["finger_number"] == 3


class TestRestAndWebSocketCoexistence:
    def test_a_template_enrolled_over_rest_is_identified_over_websocket(self, client):
        client.post(
            "/api/v1/biometric/facial/enroll",
            json={"person_id": PERSON, "encoding": UNIT_VECTOR, "model_version": "facenet-v1"},
        )

        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, ws_router.FACIAL_IDENTIFY, {"encoding": UNIT_VECTOR})
            ack = ws.receive_json()

        assert ack["result"]["person_id"] == PERSON

    def test_a_template_enrolled_over_websocket_is_found_over_rest(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, ws_router.FACIAL_ENROLL, {"person_id": PERSON, "encoding": UNIT_VECTOR})
            ws.receive_json()

        response = client.get(f"/api/v1/biometric/facial/{PERSON}")
        assert response.status_code == 200
        assert response.json()["person_id"] == PERSON


class TestBroadcastNotifications:
    def test_other_connected_clients_are_notified_of_an_identify(self, client):
        with client.websocket_connect(WS_PATH) as observer:
            with client.websocket_connect(WS_PATH) as device:
                _send(device, ws_router.FACIAL_ENROLL, {"person_id": PERSON, "encoding": UNIT_VECTOR})
                enroll_ack = device.receive_json()
                enroll_event = observer.receive_json()
                assert enroll_ack["type"] == f"{ws_router.FACIAL_ENROLL}.ack"
                assert enroll_event["type"] == "attendance.event"
                assert enroll_event["event_type"] == "FACIAL_ENROLLED"

                _send(
                    device,
                    ws_router.FACIAL_IDENTIFY,
                    {"encoding": UNIT_VECTOR},
                    direction="CHECK_OUT",
                )
                identify_ack = device.receive_json()
                identify_event = observer.receive_json()

        assert identify_ack["result"]["person_id"] == PERSON
        assert identify_event["type"] == "attendance.event"
        assert identify_event["event_type"] == "CHECK_OUT"
        assert identify_event["person_id"] == PERSON
        assert identify_event["biometric_type"] == "FACIAL"
        assert identify_event["timestamp"]

    def test_the_sender_does_not_receive_its_own_broadcast(self, client):
        with client.websocket_connect(WS_PATH) as device:
            _send(device, ws_router.FACIAL_ENROLL, {"person_id": PERSON, "encoding": UNIT_VECTOR})
            ack = device.receive_json()
            assert ack["type"] == f"{ws_router.FACIAL_ENROLL}.ack"

            # If the broadcast had echoed back to the sender, it would be
            # queued here instead of the ping's pong.
            _send(device, ws_router.PING)
            pong = device.receive_json()
            assert pong["type"] == "pong"


class TestIdempotentReplay:
    def test_resending_the_same_client_message_id_replays_the_cached_response(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(
                ws,
                ws_router.FACIAL_ENROLL,
                {"person_id": PERSON, "encoding": UNIT_VECTOR},
                client_message_id="retry-1",
            )
            first = ws.receive_json()

            _send(
                ws,
                ws_router.FACIAL_ENROLL,
                {"person_id": PERSON, "encoding": UNIT_VECTOR},
                client_message_id="retry-1",
            )
            replay = ws.receive_json()

            _send(
                ws,
                ws_router.FACIAL_ENROLL,
                {"person_id": PERSON, "encoding": UNIT_VECTOR},
                client_message_id="retry-2",
            )
            fresh = ws.receive_json()

        assert first["result"]["template_version"] == 1
        assert replay == first
        assert fresh["result"]["template_version"] == 2

    def test_idempotency_survives_a_reconnect(self, client):
        """A connection can drop after the server processed a message but
        before the ack arrived; the client reconnects and resends the same
        `client_message_id` instead of assuming it was lost."""
        with client.websocket_connect(WS_PATH) as ws1:
            _send(
                ws1,
                ws_router.FACIAL_ENROLL,
                {"person_id": PERSON, "encoding": UNIT_VECTOR},
                client_message_id="retry-1",
            )
            first = ws1.receive_json()

        with client.websocket_connect(WS_PATH) as ws2:
            _send(
                ws2,
                ws_router.FACIAL_ENROLL,
                {"person_id": PERSON, "encoding": UNIT_VECTOR},
                client_message_id="retry-1",
            )
            replay = ws2.receive_json()

        assert replay == first
        assert replay["result"]["template_version"] == 1


class TestMessageValidation:
    def test_malformed_json_returns_a_bad_request_error_frame(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            ws.send_text("not json")
            error = ws.receive_json()

        assert error["type"] == "error"
        assert error["error"] == "BadRequest"

    def test_unknown_message_type_returns_a_bad_request_error_frame(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, "facial.teleport", {"encoding": UNIT_VECTOR})
            error = ws.receive_json()

        assert error["type"] == "error"
        assert error["error"] == "BadRequest"


class TestHeartbeatAndIdleTimeout:
    def test_ping_gets_a_pong(self, client):
        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, ws_router.PING, client_message_id="hb-1")
            pong = ws.receive_json()

        assert pong["type"] == "pong"
        assert pong["client_message_id"] == "hb-1"

    def test_a_silent_connection_is_closed_after_the_idle_timeout(self, monkeypatch, stores):
        monkeypatch.setenv("BIOMETRIC_MONGO_ENABLED", "false")
        monkeypatch.setenv("BIOMETRIC_WS_IDLE_TIMEOUT_SECONDS", "1")
        get_settings.cache_clear()

        app.dependency_overrides[get_facial_repository_ws] = lambda: stores["facial"]
        app.dependency_overrides[get_fingerprint_repository_ws] = lambda: stores["fingerprint"]
        app.dependency_overrides[get_match_log_repository_ws] = lambda: stores["match_logs"]

        try:
            with TestClient(app) as test_client:
                with pytest.raises(WebSocketDisconnect) as exc_info:
                    with test_client.websocket_connect(WS_PATH) as ws:
                        ws.receive_text()  # blocks until the idle timeout closes the socket
                assert exc_info.value.code == 1001
        finally:
            app.dependency_overrides.clear()
            get_settings.cache_clear()


class TestConnectionRegistry:
    def test_disconnecting_removes_the_connection_from_the_registry(self, client):
        manager = app.state.ws_connection_manager
        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, ws_router.PING)
            ws.receive_json()
            assert manager.connection_count() == 1

        assert manager.connection_count() == 0


class TestFrameHandlerResilience:
    def test_an_unexpected_exception_during_dispatch_returns_an_error_frame_not_a_dropped_connection(
        self, client, monkeypatch
    ):
        """A non-HTTPException/ValidationError failure inside `_dispatch` (a dlib
        RuntimeError, a Mongo error, ...) must degrade to an error frame, not
        propagate and kill the connection — otherwise the frontend's
        reconnect-and-resend logic would resend the same poison message forever."""

        async def _boom(*args, **kwargs):
            raise RuntimeError("dlib exploded")

        monkeypatch.setattr(ws_router, "identify_facial", _boom)

        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, ws_router.FACIAL_IDENTIFY, {"encoding": UNIT_VECTOR}, client_message_id="boom-1")
            error = ws.receive_json()
            assert error["type"] == "error"
            assert error["error"] == "InternalError"
            assert error["client_message_id"] == "boom-1"

            # the connection must still be usable afterwards
            _send(ws, ws_router.PING)
            pong = ws.receive_json()
            assert pong["type"] == "pong"


class TestWebSocketAuthentication:
    def test_missing_token_closes_the_handshake(self, auth_client):
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with auth_client.websocket_connect(WS_PATH) as ws:
                ws.receive_text()
        assert exc_info.value.code == security.WS_CLOSE_UNAUTHORIZED

    def test_student_without_permission_is_rejected(self, auth_client):
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with auth_client.websocket_connect(f"{WS_PATH}?token={STUDENT}") as ws:
                ws.receive_text()
        assert exc_info.value.code == security.WS_CLOSE_FORBIDDEN

    def test_admin_token_is_accepted(self, auth_client):
        with auth_client.websocket_connect(f"{WS_PATH}?token={ADMIN}") as ws:
            _send(ws, ws_router.PING)
            pong = ws.receive_json()
        assert pong["type"] == "pong"


class TestFacialImageOverWebSocket:
    def _completed_liveness_token(self, client, monkeypatch) -> str:
        monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
        monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: True)
        challenge = client.get(f"{FACIAL_PREFIX}/liveness-challenge", params={"actions": 2}).json()
        token = challenge["challenge_token"]
        for step in range(len(challenge["actions"])):
            response = client.post(
                f"{FACIAL_PREFIX}/liveness-step",
                json={"challenge_token": token, "action_index": step, "images": [FAKE_IMAGE] * 6},
            )
            assert response.status_code == 200, response.json()
            token = response.json()["challenge_token"]
        return token

    def test_identify_image_ack_matches_the_rest_response_shape(self, client, monkeypatch):
        monkeypatch.setattr(facial_router, "face_encoding", lambda image: UNIT_VECTOR)
        # Enrolling over the vector REST endpoint (no liveness) leaves an active
        # template whose encoding is the same UNIT_VECTOR face_encoding returns.
        client.post(f"{FACIAL_PREFIX}/enroll", json={"person_id": PERSON, "encoding": UNIT_VECTOR})
        token = self._completed_liveness_token(client, monkeypatch)

        with client.websocket_connect(WS_PATH) as ws:
            _send(
                ws,
                "facial.identify_image",
                {"image_base64": FAKE_IMAGE, "challenge_token": token},
                client_message_id="c1",
            )
            ack = ws.receive_json()

        assert ack["type"] == "facial.identify_image.ack"
        assert ack["client_message_id"] == "c1"
        assert ack["result"]["person_id"] == PERSON
        assert ack["result"]["score"] == pytest.approx(1.0)


class TestFingerprintSampleOverWebSocket:
    def test_identify_sample_ack_matches_the_rest_response_shape(self, client, monkeypatch):
        import infrastructure.web.routers.fingerprint_router as fingerprint_router
        monkeypatch.setattr(fingerprint_router, "decode_fingerprint", lambda data, max_bytes, max_pixels: "decoded")
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 999)

        # Enrolar por /enroll-sample deja un template con raw_sample_b64 activo
        # para PERSON, dedo 1 — la única clase de template que identify-sample
        # considera candidato (ver `_raw_sample_candidates`).
        client.post(
            "/api/v1/biometric/fingerprint/enroll-sample",
            json={"person_id": PERSON, "finger_number": 1, "data_base64": "seed", "quality": 80},
        )

        with client.websocket_connect(WS_PATH) as ws:
            _send(
                ws,
                "fingerprint.identify_sample",
                {"sample_format": 1, "data_base64": "x", "quality": 80},
                client_message_id="f1",
            )
            ack = ws.receive_json()

        assert ack["type"] == "fingerprint.identify_sample.ack"
        assert ack["result"]["person_id"] == PERSON
        assert ack["result"]["finger_number"] == 1

    def test_identify_sample_broadcasts_an_attendance_event_to_other_clients(self, client, monkeypatch):
        import infrastructure.web.routers.fingerprint_router as fingerprint_router
        monkeypatch.setattr(fingerprint_router, "decode_fingerprint", lambda data, max_bytes, max_pixels: "decoded")
        monkeypatch.setattr(fingerprint_router, "fingerprint_keypoint_score", lambda a, b: 999)

        client.post(
            "/api/v1/biometric/fingerprint/enroll-sample",
            json={"person_id": PERSON, "finger_number": 1, "data_base64": "seed", "quality": 80},
        )

        with client.websocket_connect(WS_PATH) as observer:
            with client.websocket_connect(WS_PATH) as kiosk:
                _send(
                    kiosk,
                    "fingerprint.identify_sample",
                    {"sample_format": 1, "data_base64": "x", "quality": 80},
                    direction="CHECK_IN",
                )
                kiosk.receive_json()
                event = observer.receive_json()

        assert event["type"] == "attendance.event"
        assert event["event_type"] == "CHECK_IN"
        assert event["person_id"] == PERSON
        assert event["biometric_type"] == "FINGERPRINT"
        assert event["finger_number"] == 1
        assert event["score"] == 999
