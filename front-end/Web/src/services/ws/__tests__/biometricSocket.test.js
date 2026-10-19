jest.mock("../../../api/apiClient", () => ({
    getToken: jest.fn(),
    resolveBaseUrl: jest.fn(() => "http://localhost:8080"),
}));

import { connectBiometricSocket } from "../biometricSocket";
import { getToken } from "../../../api/apiClient";

class FakeWebSocket {
    constructor(url) {
        this.url = url;
        this.sent = [];
        this.readyState = 0; // CONNECTING
        FakeWebSocket.instances.push(this);
    }
    send(data) { this.sent.push(data); }
    close() {
        this.readyState = 3; // CLOSED
        this.onclose?.({ code: 1000 });
    }
    triggerOpen() {
        this.readyState = 1; // OPEN
        this.onopen?.();
    }
    triggerMessage(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
    triggerClose(code = 1006) {
        this.readyState = 3; // CLOSED
        this.onclose?.({ code });
    }
}
FakeWebSocket.instances = [];

beforeEach(() => {
    FakeWebSocket.instances = [];
    global.WebSocket = FakeWebSocket;
    getToken.mockReset();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

test("send() resolves with the ack result for the matching client_message_id", async () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    const pending = socket.send("facial.identify_image", { image_base64: "x" });
    const sentBody = JSON.parse(ws.sent[0]);
    ws.triggerMessage({
        type: "facial.identify_image.ack",
        client_message_id: sentBody.client_message_id,
        result: { person_id: "p1", score: 0.99 },
    });

    await expect(pending).resolves.toEqual({ person_id: "p1", score: 0.99 });
});

test("send() rejects when the server returns an error frame for that client_message_id", async () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    const pending = socket.send("facial.identify_image", { image_base64: "x" });
    const sentBody = JSON.parse(ws.sent[0]);
    ws.triggerMessage({
        type: "error",
        client_message_id: sentBody.client_message_id,
        error: "NotFound",
        message: "no match found",
    });

    await expect(pending).rejects.toMatchObject({ message: "no match found" });
});

test("resends the same client_message_id once after a reconnect, before the ack arrives", async () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws1 = FakeWebSocket.instances[0];
    ws1.triggerOpen();

    const pending = socket.send("facial.identify_image", { image_base64: "x" });
    const firstId = JSON.parse(ws1.sent[0]).client_message_id;
    ws1.triggerClose();

    jest.advanceTimersByTime(1000); // first reconnect backoff
    const ws2 = FakeWebSocket.instances[1];
    ws2.triggerOpen();

    expect(JSON.parse(ws2.sent[0]).client_message_id).toBe(firstId);

    ws2.triggerMessage({
        type: "facial.identify_image.ack",
        client_message_id: firstId,
        result: { person_id: "p1", score: 0.99 },
    });
    await expect(pending).resolves.toEqual({ person_id: "p1", score: 0.99 });
});

test("sends a ping heartbeat every 20 seconds", () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    jest.advanceTimersByTime(20000);
    expect(JSON.parse(ws.sent.at(-1)).type).toBe("ping");
});

test("close() is intentional and does not trigger a reconnect attempt", () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws1 = FakeWebSocket.instances[0];
    ws1.triggerOpen();

    socket.close();
    jest.advanceTimersByTime(10000);

    expect(FakeWebSocket.instances.length).toBe(1);
});

test("onAttendanceEvent notifies listeners on attendance.event frames and supports unsubscribe", () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    const listener = jest.fn();
    const unsubscribe = socket.onAttendanceEvent(listener);

    ws.triggerMessage({ type: "attendance.event", payload: { foo: "bar" } });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    ws.triggerMessage({ type: "attendance.event", payload: { foo: "baz" } });
    expect(listener).toHaveBeenCalledTimes(1);
});

test("onStatusChange reports connecting/open/reconnecting/closed transitions", () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws1 = FakeWebSocket.instances[0];

    const statuses = [];
    socket.onStatusChange((status) => statuses.push(status));

    ws1.triggerOpen();
    ws1.triggerClose();
    jest.advanceTimersByTime(1000);
    const ws2 = FakeWebSocket.instances[1];
    ws2.triggerOpen();
    socket.close();

    expect(statuses).toEqual(["open", "reconnecting", "open", "closed"]);
});

// ── Fix coverage: reviewer findings on commit d3f8f20 ──────────────────────

test("a listener registered immediately after construction observes the initial connecting status", async () => {
    const statuses = [];
    // onStatusChange is wired up right after connectBiometricSocket returns —
    // this is the exact timing a real caller uses.
    const socket = connectBiometricSocket({ token: "t" });
    socket.onStatusChange((status) => statuses.push(status));

    await Promise.resolve();
    await Promise.resolve();

    expect(statuses).toEqual(["connecting"]);
});

test("send() queues the message until the socket reaches open instead of throwing or dropping it", async () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws = FakeWebSocket.instances[0];
    // Socket is still CONNECTING (readyState 0) — no triggerOpen() yet.

    const pending = socket.send("facial.identify_image", { image_base64: "x" });
    expect(ws.sent.length).toBe(0); // not transmitted yet, and nothing threw

    ws.triggerOpen();
    expect(ws.sent.length).toBe(1); // flushed exactly once the socket opened

    const sentBody = JSON.parse(ws.sent[0]);
    ws.triggerMessage({
        type: "facial.identify_image.ack",
        client_message_id: sentBody.client_message_id,
        result: { person_id: "p1", score: 0.99 },
    });

    await expect(pending).resolves.toEqual({ person_id: "p1", score: 0.99 });
});

test("still schedules a reconnect attempt when the token lookup rejects during connect", async () => {
    getToken.mockRejectedValueOnce(new Error("token unavailable"));

    connectBiometricSocket({}); // no token given -> must resolve it via getToken()
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeWebSocket.instances.length).toBe(0); // connect failed before any socket existed

    jest.advanceTimersByTime(1000); // first reconnect backoff
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeWebSocket.instances.length).toBe(1); // reconnection was still attempted
});

test("close() rejects any send() still awaiting an ack instead of leaving it hanging", async () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    const pending = socket.send("facial.identify_image", { image_base64: "x" });
    socket.close();

    await expect(pending).rejects.toMatchObject({ message: "Biometric socket closed" });
});

// ── Fix coverage: final whole-branch review, Important #10 (frontend half) ──

test("send() rejects on its own after a timeout if no ack ever arrives", async () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    const pending = socket.send("facial.identify_image", { image_base64: "x" });
    jest.advanceTimersByTime(20000); // past SEND_TIMEOUT_MS, no ack ever sent

    await expect(pending).rejects.toMatchObject({ message: expect.stringContaining("timed out") });
});

test("a send() that does get its ack before the timeout is unaffected by it", async () => {
    const socket = connectBiometricSocket({ token: "t" });
    const ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    const pending = socket.send("facial.identify_image", { image_base64: "x" });
    const sentBody = JSON.parse(ws.sent[0]);
    ws.triggerMessage({
        type: "facial.identify_image.ack",
        client_message_id: sentBody.client_message_id,
        result: { person_id: "p1", score: 0.99 },
    });

    jest.advanceTimersByTime(20000); // the send-timeout firing late must not reject it

    await expect(pending).resolves.toEqual({ person_id: "p1", score: 0.99 });
});

test("gives up resending a message after a fixed number of reconnect attempts and rejects it", async () => {
    const socket = connectBiometricSocket({ token: "t" });
    let ws = FakeWebSocket.instances[0];
    ws.triggerOpen();

    const pending = socket.send("facial.identify_image", { image_base64: "x" }); // attempt 1
    const firstId = JSON.parse(ws.sent[0]).client_message_id;

    // Two reconnects, each one resending the same message (attempts 2 and 3).
    for (let i = 0; i < 2; i += 1) {
        ws.triggerClose();
        jest.advanceTimersByTime(1000);
        ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
        ws.triggerOpen();
        expect(JSON.parse(ws.sent.at(-1)).client_message_id).toBe(firstId);
    }

    // A 4th attempt would exceed MAX_SEND_ATTEMPTS -> give up instead of resending.
    ws.triggerClose();
    jest.advanceTimersByTime(1000);
    ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    ws.triggerOpen();

    await expect(pending).rejects.toMatchObject({ message: expect.stringContaining("gave up") });
    expect(ws.sent.length).toBe(0); // nothing was transmitted for this message this time
});
