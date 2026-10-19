# Attendance Kiosk WebSocket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la pantalla web de asistencia en vivo (kiosco) donde el profesor inicia la clase y cada estudiante se reconoce por rostro o huella, comunicándose con `06-ms-biometric` por WebSocket, sin tocar teclado/mouse.

**Architecture:** Extender el canal WS existente de `06-ms-biometric` con dos mensajes nuevos que envuelven los endpoints REST de imagen/muestra ya existentes (mismo patrón de reutilización que `facial.identify`/`fingerprint.identify`). En el frontend, una nueva pantalla orquesta: selección/apertura de `class_session` (scheduling, ya existe), captura biométrica sobre un WebSocket (reutilizando `useFaceCapture`/`useFingerprintReader` casi sin cambios) y creación de `attendance_record` (attendance, ya existe) con deduplicación local + la garantía real a nivel de BD.

**Tech Stack:** FastAPI/Python (back-end/06-ms-biometric), React Native Web + React Navigation + Jest/react-test-renderer (front-end/Web). Sin cambios en Java (scheduling/attendance).

**Spec:** [docs/superpowers/specs/2026-10-12-attendance-kiosk-design.md](../specs/2026-10-12-attendance-kiosk-design.md)

## Global Constraints

- No se modifican `04-ms-scheduling` ni `05-ms-attendance` (Java) — se consumen tal cual.
- No se toca `front-end/Mobile`.
- No se agregan `facial.enroll`/`fingerprint.enroll` por WS — el enrolamiento sigue siendo solo REST (pantalla `Biometrics` existente).
- El reto de vida (`/liveness-challenge`, `/liveness-step`) sigue siendo REST en todos los casos.
- Los nuevos mensajes WS reutilizan los modelos Pydantic y las corutinas REST ya existentes (`identify_facial_image`, `identify_fingerprint_sample`) — cero duplicación de lógica de matching.
- Heartbeat del cliente WS: `ping` cada 20000 ms (antes del `BIOMETRIC_WS_IDLE_TIMEOUT_SECONDS` de 60s del servidor).
- `attendanceStatus` creado por el kiosco es siempre `"Present"` (sin detección de tardanza en este cambio).
- Gate de permiso del nuevo flujo: `permissions.canRegisterFace` (mismo que ya usa el botón "Tomar asistencia" — sin cambios en `useRolePermissions.js`).
- Mensajes en pantalla: imperativos, ≤ 4-5 palabras, legibles a distancia.

## Review Focus

- **Reconexión del WebSocket a mitad de clase** (contenedor de `06-ms-biometric` reiniciado, red inestable): la pantalla debe mostrar "Reconectando…" y seguir funcionando al volver, nunca quedar congelada ni perder el estado de la clase abierta.
- **Reintento tras caída con un identify en vuelo**: si el socket cae justo después de enviar `facial.identify_image`/`fingerprint.identify_sample` pero antes de recibir el ack, al reconectar se debe reenviar el mismo mensaje con el mismo `client_message_id` — nunca generar un segundo intento con id distinto (eso rompería la garantía de idempotencia del servidor).
- **Doble registro en carrera** (dos pestañas/kioscos o un reintento del cliente): un 409 de `POST /attendance-records` debe tratarse como `DUPLICATE`, nunca mostrarse como error al estudiante.
- **`class_session` ya abierta** (el profesor recarga la página a mitad de clase y vuelve a "Iniciar clase" sobre el mismo bloque/fecha): `openSession` devuelve 400 "already Open" — el flujo debe seguir usando esa sesión en vez de mostrar un error bloqueante.
- **Persona reconocida que no pertenece a la cohorte de esta sesión** (identify exitoso pero `person_id` no está en el mapa de matriculados de este bloque): debe mostrarse como error de negocio ("No pertenece a esta clase"), nunca crear un `attendance_record` para un `academicActorId` inexistente ni reventar la pantalla.

---

## Task 1: Backend — mensaje WS `facial.identify_image`

**Files:**
- Modify: `back-end/06-ms-biometric/infrastructure/web/routers/ws_router.py`
- Test: `back-end/06-ms-biometric/tests/unit/web/test_ws_router.py`

**Interfaces:**
- Consumes: `identify_facial_image(req, request, repository, match_logs, threshold, secret, settings)` y `IdentifyFacialImageRequest` de `infrastructure/web/routers/facial_router.py` (ya existen, sin cambios); `get_liveness_secret` de `infrastructure/config/dependencies.py` (ya existe).
- Produces: tipo de mensaje WS `"facial.identify_image"` manejable por `_dispatch`/`_handle_frame`; `biometric_ws` ahora inyecta también `secret: str = Depends(get_liveness_secret)`.

- [ ] **Step 1: Escribir el test que falla**

En `test_ws_router.py`, añadir una clase `TestFacialImageOverWebSocket` (mismo archivo, mismos fixtures `client`/`stores` ya existentes) con:

```python
class TestFacialImageOverWebSocket:
    def test_identify_image_ack_matches_the_rest_response_shape(self, client, monkeypatch):
        import infrastructure.web.routers.facial_router as facial_router
        monkeypatch.setattr(facial_router, "decode_image", lambda data, max_bytes, max_pixels: "decoded")
        monkeypatch.setattr(facial_router, "validate_liveness", lambda images, action: True)
        monkeypatch.setattr(facial_router, "face_encoding", lambda image: UNIT_VECTOR)

        # Enrolar por el endpoint vectorial REST (sin liveness) deja un template
        # activo con el mismo UNIT_VECTOR que devolverá el face_encoding monkeypatcheado.
        client.post("/api/v1/biometric/facial/enroll", json={"person_id": PERSON, "encoding": UNIT_VECTOR})

        challenge = client.get("/api/v1/biometric/facial/liveness-challenge", params={"actions": 2}).json()
        token = challenge["challenge_token"]
        for step in range(2):
            resp = client.post(
                "/api/v1/biometric/facial/liveness-step",
                json={"challenge_token": token, "action_index": step, "images": ["x"] * 6},
            )
            token = resp.json()["challenge_token"]

        with client.websocket_connect(WS_PATH) as ws:
            _send(ws, "facial.identify_image", {"image_base64": "x", "challenge_token": token}, client_message_id="c1")
            ack = ws.receive_json()

        assert ack["type"] == "facial.identify_image.ack"
        assert ack["result"]["person_id"] == PERSON
```

Nota: `BIOMETRIC_LIVENESS_CHALLENGE_SECRET` debe quedar fijado vía `monkeypatch.setenv(...)` + `get_settings.cache_clear()` igual que en `test_facial_image_endpoints.py`, si el fixture `client` de este archivo todavía no lo hace — revisar y añadirlo al fixture `client` si falta, antes de escribir este test.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pytest tests/unit/web/test_ws_router.py::TestFacialImageOverWebSocket -v`
Expected: FAIL (`unknown message type: facial.identify_image` o `KeyError`).

- [ ] **Step 3: Implementar en `ws_router.py`**

Imports nuevos:
```python
from infrastructure.web.routers.facial_router import (
    EnrollFacialRequest,
    IdentifyFacialRequest,
    IdentifyFacialImageRequest,
    VerifyFacialRequest,
    enroll_facial,
    identify_facial,
    identify_facial_image,
    verify_facial,
)
from infrastructure.config.dependencies import (
    get_facial_repository_ws,
    get_fingerprint_repository_ws,
    get_liveness_secret,
    get_match_log_repository_ws,
    get_similarity_threshold,
)
```

Nueva constante junto a las demás: `FACIAL_IDENTIFY_IMAGE = "facial.identify_image"`.

`_PAYLOAD_MODELS[FACIAL_IDENTIFY_IMAGE] = IdentifyFacialImageRequest`.

`_dispatch` gana el parámetro `secret: str` (keyword, junto a `threshold`). Nueva rama antes del `else` final (identify vectorial):

```python
if message_type == FACIAL_IDENTIFY_IMAGE:
    result = await identify_facial_image(
        data, fake_request, facial_repo, match_logs, threshold, secret, settings
    )
    event = {
        "event_type": direction,
        "person_id": result["person_id"],
        "biometric_type": "FACIAL",
        "finger_number": None,
        "score": result["score"],
        "timestamp": _now_iso(),
        "correlation_id": correlation_id,
    }
    return result, event
```

`_handle_frame` gana el parámetro `secret: str` y lo reenvía a `_dispatch`. `biometric_ws` gana `secret: str = Depends(get_liveness_secret)` y lo pasa a `_handle_frame`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pytest tests/unit/web/test_ws_router.py -v`
Expected: PASS (incluyendo todas las clases preexistentes, sin regresión).

- [ ] **Step 5: Commit**

```bash
git add back-end/06-ms-biometric/infrastructure/web/routers/ws_router.py back-end/06-ms-biometric/tests/unit/web/test_ws_router.py
git commit -m "feat(biometric): add facial.identify_image over the websocket channel"
```

---

## Task 2: Backend — mensaje WS `fingerprint.identify_sample` + documentación

**Files:**
- Modify: `back-end/06-ms-biometric/infrastructure/web/routers/ws_router.py`
- Modify: `back-end/06-ms-biometric/SERVICE.md`
- Test: `back-end/06-ms-biometric/tests/unit/web/test_ws_router.py`

**Interfaces:**
- Consumes: `identify_fingerprint_sample(req, request, repository, match_logs, fp_threshold, settings)` y `IdentifyFingerprintSampleRequest` de `fingerprint_router.py` (ya existen); `get_fingerprint_match_threshold` de `dependencies.py` (ya existe).
- Produces: tipo de mensaje WS `"fingerprint.identify_sample"`; `biometric_ws` ahora también inyecta `fp_threshold: int = Depends(get_fingerprint_match_threshold)`.

- [ ] **Step 1: Escribir el test que falla**

```python
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pytest tests/unit/web/test_ws_router.py::TestFingerprintSampleOverWebSocket -v`
Expected: FAIL (`unknown message type: fingerprint.identify_sample`).

- [ ] **Step 3: Implementar en `ws_router.py`**

Imports nuevos desde `fingerprint_router.py`: añadir `IdentifyFingerprintSampleRequest`, `identify_fingerprint_sample` al import ya existente. Importar `get_fingerprint_match_threshold` desde `dependencies.py`.

Constante: `FINGERPRINT_IDENTIFY_SAMPLE = "fingerprint.identify_sample"`; `_PAYLOAD_MODELS[FINGERPRINT_IDENTIFY_SAMPLE] = IdentifyFingerprintSampleRequest`.

`_dispatch` gana `fp_threshold: int`. Nueva rama:

```python
if message_type == FINGERPRINT_IDENTIFY_SAMPLE:
    result = await identify_fingerprint_sample(
        data, fake_request, fingerprint_repo, match_logs, fp_threshold, settings
    )
    event = {
        "event_type": direction,
        "person_id": result["person_id"],
        "biometric_type": "FINGERPRINT",
        "finger_number": result.get("finger_number"),
        "score": result["score"],
        "timestamp": _now_iso(),
        "correlation_id": correlation_id,
    }
    return result, event
```

`_handle_frame` y `biometric_ws` ganan `fp_threshold: int = Depends(get_fingerprint_match_threshold)`, igual que `secret` en la Tarea 1.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pytest tests/unit/web/test_ws_router.py -v`
Expected: PASS, todas las clases.

- [ ] **Step 5: Documentar en `SERVICE.md`**

En la sección 4.5 (tabla de tipos WS), añadir dos filas junto a las existentes:

| `type` | Equivalente REST | Respuesta |
|---|---|---|
| `facial.identify_image` | `POST .../facial/identify-image` | `<type>.ack`; dispara `attendance.event` |
| `fingerprint.identify_sample` | `POST .../fingerprint/identify-sample` | `<type>.ack`; dispara `attendance.event` |

Y una frase aclarando que el reto de vida (`liveness-challenge`/`liveness-step`) sigue siendo exclusivamente REST incluso para clientes que usan estos dos tipos.

- [ ] **Step 6: Commit**

```bash
git add back-end/06-ms-biometric/infrastructure/web/routers/ws_router.py back-end/06-ms-biometric/tests/unit/web/test_ws_router.py back-end/06-ms-biometric/SERVICE.md
git commit -m "feat(biometric): add fingerprint.identify_sample over the websocket channel"
```

---

## Task 3: Frontend — cliente `biometricSocket.js`

**Files:**
- Modify: `front-end/Web/src/api/apiClient.js` (exportar `resolveBaseUrl`)
- Create: `front-end/Web/src/services/ws/biometricSocket.js`
- Test: `front-end/Web/src/services/ws/__tests__/biometricSocket.test.js`

**Interfaces:**
- Consumes: `resolveBaseUrl(override)` (recién exportada) y `getToken()`, ambas de `api/apiClient.js`.
- Produces:
  ```js
  export function connectBiometricSocket({ token, baseUrl } = {}): {
      send(type: string, payload: object, direction?: "CHECK_IN" | "CHECK_OUT"): Promise<object>, // resuelve con result del ack
      onAttendanceEvent(listener: (event: object) => void): () => void, // unsubscribe
      onStatusChange(listener: (status: "connecting"|"open"|"reconnecting"|"closed") => void): () => void,
      close(): void,
  }
  ```
  Usado por las Tareas 5, 6 y 8.

- [ ] **Step 1: Exportar `resolveBaseUrl` (sin cambiar su lógica)**

En `front-end/Web/src/api/apiClient.js:98`, cambiar `function resolveBaseUrl(override) {` por `export function resolveBaseUrl(override) {`.

- [ ] **Step 2: Escribir los tests que fallan**

```js
// src/services/ws/__tests__/biometricSocket.test.js
import { connectBiometricSocket } from "../biometricSocket";

class FakeWebSocket {
    constructor(url) {
        this.url = url;
        this.sent = [];
        FakeWebSocket.instances.push(this);
    }
    send(data) { this.sent.push(data); }
    close() { this.onclose?.({ code: 1000 }); }
    triggerOpen() { this.onopen?.(); }
    triggerMessage(obj) { this.onmessage?.({ data: JSON.stringify(obj) }); }
    triggerClose(code = 1006) { this.onclose?.({ code }); }
}
FakeWebSocket.instances = [];

beforeEach(() => {
    FakeWebSocket.instances = [];
    global.WebSocket = FakeWebSocket;
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

    jest.advanceTimersByTime(1000); // primer backoff de reconexión
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
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `npx jest src/services/ws/__tests__/biometricSocket.test.js`
Expected: FAIL (`connectBiometricSocket is not a function`).

- [ ] **Step 4: Implementar `biometricSocket.js`**

```js
import { getToken, resolveBaseUrl } from "../../api/apiClient";

const HEARTBEAT_MS = 20000;
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000];

export function connectBiometricSocket({ token, baseUrl } = {}) { /* ver algoritmo abajo */ }
```

Algoritmo (la parte no determinada por la firma):
- Construir la URL reemplazando `http`→`ws` / `https`→`wss` en `resolveBaseUrl(baseUrl)` y agregando `/api/v1/biometric/ws?token=<token ?? await getToken()>`.
- Mantener un `Map<client_message_id, {type, payload, direction, resolve, reject}>` de solicitudes pendientes (`uuid` propio o `Date.now()+Math.random()` para el id — no hay librería uuid en el proyecto, revisar `package.json`; si no existe, generar con `Math.random().toString(36)`).
- `send(type, payload, direction)`: genera `client_message_id`, guarda la entrada pendiente, serializa y envía `{type, client_message_id, direction, payload}`; devuelve la promesa.
- `onmessage`: parsear JSON; si `type === "attendance.event"` → notificar a los listeners de `onAttendanceEvent`; si `type.endsWith(".ack")` o `type === "error"` → buscar la entrada pendiente por `client_message_id`, resolver/rechazar y eliminarla del mapa.
- `onclose` inesperado (código ≠ 1000, es decir no fue un `close()` explícito): notificar `status = "reconnecting"`, programar reconexión con el próximo valor de `RECONNECT_DELAYS_MS` (se queda en el último valor si se agotan), abrir un nuevo `WebSocket` y, en su `onopen`, **reenviar cada entrada aún pendiente en el mapa con el mismo `client_message_id`** (no generar uno nuevo).
- `close()`: marca el cierre como intencional (para que `onclose` no dispare reconexión), cierra el socket, notifica `status = "closed"`.
- Heartbeat: `setInterval` cada `HEARTBEAT_MS` mientras el socket esté abierto, enviando `{"type": "ping"}` (sin `client_message_id`, no entra al mapa de pendientes).

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx jest src/services/ws/__tests__/biometricSocket.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add front-end/Web/src/api/apiClient.js front-end/Web/src/services/ws/biometricSocket.js front-end/Web/src/services/ws/__tests__/biometricSocket.test.js
git commit -m "feat(web): add the biometric websocket client"
```

---

## Task 4: Frontend — `attendanceApi.createRecord` y `cohortActorByPerson`

**Files:**
- Modify: `front-end/Web/src/services/api/attendanceApi.js`
- Modify: `front-end/Web/src/services/api/referenceData.js`
- Test: `front-end/Web/src/services/api/__tests__/referenceData.test.js`

**Interfaces:**
- Produces: `attendanceApi.createRecord({classSessionId, academicActorId, attendanceStatus, captureMethod, matchScore})` (usado por Tarea 8); `cohortActorByPerson(cohortId): Promise<Map<personId, academicActorId>>` (usado por Tarea 8).

- [ ] **Step 1: Añadir `createRecord` (sin test dedicado — una línea que reutiliza `request`, mismo patrón que el resto del archivo)**

En `attendanceApi.js`, junto a `listRecords`:
```js
createRecord: (b) => request(endpoints.attendance.records, { method: "POST", body: b }),
```

- [ ] **Step 2: Escribir el test que falla para `cohortActorByPerson`**

```js
// src/services/api/__tests__/referenceData.test.js
jest.mock("../../../api/apiClient", () => ({
    fetchAllPages: jest.fn(),
    request: jest.fn(),
}));
import { fetchAllPages } from "../../../api/apiClient";
import { cohortActorByPerson, resetReferenceData, setActiveSchool } from "../referenceData";

beforeEach(() => {
    resetReferenceData();
    setActiveSchool(null);
    fetchAllPages.mockReset();
});

test("maps personId to academicActorId only for enrollments in the given cohort", async () => {
    fetchAllPages.mockImplementation((path) => {
        if (String(path).includes("enrollments")) {
            return Promise.resolve([
                { academicActorId: 1, cohortId: 10 },
                { academicActorId: 2, cohortId: 99 },
            ]);
        }
        if (String(path).includes("actors")) {
            return Promise.resolve([
                { academicActorId: 1, personId: "person-a" },
                { academicActorId: 2, personId: "person-b" },
            ]);
        }
        return Promise.resolve([]);
    });

    const map = await cohortActorByPerson(10);

    expect(map.get("person-a")).toBe(1);
    expect(map.has("person-b")).toBe(false);
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx jest src/services/api/__tests__/referenceData.test.js`
Expected: FAIL (`cohortActorByPerson is not a function`).

- [ ] **Step 4: Implementar `cohortActorByPerson` en `referenceData.js`**

```js
export const cohortActorByPerson = (cohortId) =>
    memo(`cohortActorByPerson:${cohortId}`, async () => {
        const [enrollments, actors] = await Promise.all([listEnrollments(), actorMap()]);
        const map = new Map();
        for (const enrollment of enrollments) {
            if (enrollment.cohortId !== cohortId) continue;
            const actor = actors.get(enrollment.academicActorId);
            if (actor?.personId) map.set(actor.personId, enrollment.academicActorId);
        }
        return map;
    });
```

(Se apoya en `listEnrollments()` y `actorMap()`, ya existentes en el archivo — sin tocarlas.)

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx jest src/services/api/__tests__/referenceData.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add front-end/Web/src/services/api/attendanceApi.js front-end/Web/src/services/api/referenceData.js front-end/Web/src/services/api/__tests__/referenceData.test.js
git commit -m "feat(web): add attendance record creation and per-cohort actor lookup"
```

---

## Task 5: Frontend — `useFaceCapture` envía el identify final por socket

**Files:**
- Modify: `front-end/Web/src/viewmodels/useFaceCapture.js`
- Test: `front-end/Web/src/viewmodels/__tests__/useFaceCapture.test.js`

**Interfaces:**
- Consumes: `socket.send(type, payload)` de la Tarea 3 (shape: `Promise<{person_id, score}>`).
- Produces: `useFaceCapture({ vm, socket?, onIdentified? })` — mismo retorno que antes; si se pasa `socket`, `loginFace` usa `socket.send("facial.identify_image", {...})` en vez de `biometricCaptureApi.identifyFace`. Sin `socket`, comportamiento idéntico al actual (usado por la pantalla admin `Biometrics`). Tras un identify exitoso (por cualquiera de las dos vías), si se pasó `onIdentified`, se llama `onIdentified(data)` con `data = {person_id, score}` — es el gancho que la Tarea 9 usa para conectar este hook con `useAttendanceKioskViewModel.onIdentified` (Tarea 8).

- [ ] **Step 1: Escribir el test que falla**

```js
// src/viewmodels/__tests__/useFaceCapture.test.js
import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../services/api/biometricCaptureApi", () => ({
    biometricCaptureApi: {
        livenessChallenge: jest.fn().mockResolvedValue({ challenge_token: "t0", actions: ["blink", "turn"] }),
        livenessStep: jest.fn().mockResolvedValue({ challenge_token: "t1", completed: true }),
        identifyFace: jest.fn(),
    },
}));
jest.mock("../../services/api/referenceData", () => ({ personMap: jest.fn().mockResolvedValue(new Map()), fullName: () => "" }));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (s) => s }) }));

import { useFaceCapture } from "../useFaceCapture";

function renderHook(props) {
    let vm;
    function Probe() {
        vm = useFaceCapture(props);
        return null;
    }
    act(() => { create(<Probe />); });
    return () => vm;
}

beforeEach(() => {
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: () => {} });
    jest.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,x");
});

test("loginFace sends facial.identify_image over the socket and calls onIdentified with the ack result", async () => {
    const socket = { send: jest.fn().mockResolvedValue({ person_id: "p1", score: 0.9 }) };
    const vm = { run: (op) => op(), setStatus: jest.fn(), requirePersonId: jest.fn() };
    const onIdentified = jest.fn();
    const getHook = renderHook({ vm, socket, onIdentified });
    getHook().videoRef.current = { videoWidth: 10, videoHeight: 10 };

    await act(async () => {
        await getHook().loginFace();
    });

    expect(socket.send).toHaveBeenCalledWith(
        "facial.identify_image",
        expect.objectContaining({ challenge_token: expect.any(String) })
    );
    expect(onIdentified).toHaveBeenCalledWith({ person_id: "p1", score: 0.9 });
});
```

(`videoRef` ya es un `ref` normal devuelto por el hook — asignar `.current` directamente sobre el objeto que devuelve `getHook()` alcanza, sin necesidad de montar un `<video>` real ni de tocar `captureLiveness`.)

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest src/viewmodels/__tests__/useFaceCapture.test.js`
Expected: FAIL (`socket.send` no se llama; hoy `loginFace` siempre usa `biometricCaptureApi.identifyFace`).

- [ ] **Step 3: Implementar el cambio en `useFaceCapture.js`**

Cambiar la firma: `export function useFaceCapture({ vm, socket, onIdentified } = {})`.

En `loginFace` (dentro de `withLiveness`), sustituir la llamada a `biometricCaptureApi.identifyFace` por:
```js
const data = socket
    ? await socket.send("facial.identify_image", {
          image_base64: liveness.image,
          challenge_token: liveness.challengeToken,
      })
    : await biometricCaptureApi.identifyFace({
          imageBase64: liveness.image,
          challengeToken: liveness.challengeToken,
      });
onIdentified?.(data);
```
(la llamada a `onIdentified` va antes del `setStatus` existente, que no cambia). `registerFace` (enroll) no cambia — sigue siempre por REST y sin `onIdentified`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest src/viewmodels/__tests__/useFaceCapture.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front-end/Web/src/viewmodels/useFaceCapture.js front-end/Web/src/viewmodels/__tests__/useFaceCapture.test.js
git commit -m "feat(web): send the facial identify over the websocket when a socket is provided"
```

---

## Task 6: Frontend — `useFingerprintReader` envía el identify final por socket

**Files:**
- Modify: `front-end/Web/src/viewmodels/useFingerprintReader.js`
- Test: `front-end/Web/src/viewmodels/__tests__/useFingerprintReader.test.js`

**Interfaces:**
- Consumes: `socket.send(type, payload)` (Tarea 3).
- Produces: `useFingerprintReader({ vm, socket?, onIdentified? })` — igual que hoy; con `socket`, `loginFingerprint` usa `socket.send("fingerprint.identify_sample", {...})` en vez de `biometricCaptureApi.identifyFingerprint`. Tras un identify exitoso, si se pasó `onIdentified`, se llama `onIdentified(data)` con `data = {person_id, score, finger_number}` — mismo gancho que en la Tarea 5, usado por la Tarea 9.

- [ ] **Step 1: Escribir el test que falla**

```js
// src/viewmodels/__tests__/useFingerprintReader.test.js
import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../services/api/biometricCaptureApi", () => ({
    biometricCaptureApi: { identifyFingerprint: jest.fn() },
}));
jest.mock("../../services/api/referenceData", () => ({ personMap: jest.fn().mockResolvedValue(new Map()), fullName: () => "" }));
jest.mock("../../core/utils/i18n/hooks/useTranslation", () => ({ useTranslation: () => ({ t: (s) => s }) }));

import { useFingerprintReader } from "../useFingerprintReader";

function renderHook(props) {
    let vm;
    function Probe() {
        vm = useFingerprintReader(props);
        return null;
    }
    act(() => { create(<Probe />); });
    return () => vm;
}

test("loginFingerprint sends fingerprint.identify_sample over the socket and calls onIdentified with the ack result", async () => {
    const socket = { send: jest.fn().mockResolvedValue({ person_id: "p1", finger_number: 1, score: 1 }) };
    const vm = { run: (op) => op(), setStatus: jest.fn() };
    const onIdentified = jest.fn();
    const getHook = renderHook({ vm, socket, onIdentified });

    act(() => {
        getHook().__setSampleForTest({ format: 1, data: "abc", quality: 80 });
    });

    await act(async () => {
        await getHook().loginFingerprint();
    });

    expect(socket.send).toHaveBeenCalledWith(
        "fingerprint.identify_sample",
        { sample_format: 1, data_base64: "abc", quality: 80, finger_number: undefined }
    );
    expect(onIdentified).toHaveBeenCalledWith({ person_id: "p1", finger_number: 1, score: 1 });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest src/viewmodels/__tests__/useFingerprintReader.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar el cambio en `useFingerprintReader.js`**

Cambiar la firma: `export function useFingerprintReader({ vm, socket, onIdentified } = {})`.

En `loginFingerprint`, sustituir la llamada a `biometricCaptureApi.identifyFingerprint` por:
```js
const data = socket
    ? await socket.send("fingerprint.identify_sample", {
          sample_format: sample.format,
          data_base64: sample.data,
          quality: sample.quality,
          finger_number: sample.fingerNumber,
      })
    : await biometricCaptureApi.identifyFingerprint({
          sampleFormat: sample.format,
          data: sample.data,
          quality: sample.quality,
      });
onIdentified?.(data);
```
(antes del `setStatus` existente, que no cambia). `saveFingerprint` (enroll) no cambia — sigue siempre por REST y sin `onIdentified`.

Añadir también, en el objeto que devuelve el hook, `__setSampleForTest: (sample) => { stateRef.current.sample = sample; setSampleReady(true); }` — una vía de prueba explícita para precargar `stateRef.current.sample` sin simular el SDK DigitalPersona real, usada únicamente por el test del Step 1.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest src/viewmodels/__tests__/useFingerprintReader.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front-end/Web/src/viewmodels/useFingerprintReader.js front-end/Web/src/viewmodels/__tests__/useFingerprintReader.test.js
git commit -m "feat(web): send the fingerprint identify over the websocket when a socket is provided"
```

---

## Task 7: Frontend — `useAttendanceKioskViewModel`, parte A: ciclo de vida de la sesión

**Files:**
- Create: `front-end/Web/src/viewmodels/useAttendanceKioskViewModel.js`
- Test: `front-end/Web/src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js`

**Interfaces:**
- Consumes: `listBlocks()` de `referenceData.js` (ya existe); `schedulingApi.listSessions/createSession/openSession/closeSession` (ya existen); `useAuth()` → `user.academicActorId` (ya existe).
- Produces (parte A de la API del hook; la parte B en la Tarea 8 añade más campos al mismo objeto):
  ```js
  {
      view: "SELECT_SESSION" | "WAITING" | ... ,
      todaysBlocks: Array<Block>,
      startClass(block): Promise<void>, // resuelve o crea la sesión de hoy, la abre, pasa a view="WAITING"
      endClass(): Promise<void>, // cierra la sesión, pasa a view="SELECT_SESSION"
      session: ClassSessionResponse | null,
      statusMessage: string,
  }
  ```

- [ ] **Step 1: Escribir los tests que fallan**

```js
// src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js
import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../context/AuthContext", () => ({
    useAuth: () => ({ user: { academicActorId: 7 } }),
}));
jest.mock("../../services/api/referenceData", () => ({
    listBlocks: jest.fn(),
    cohortActorByPerson: jest.fn().mockResolvedValue(new Map()),
}));
jest.mock("../../services/api/schedulingApi", () => ({
    schedulingApi: {
        listSessions: jest.fn(),
        createSession: jest.fn(),
        openSession: jest.fn(),
        closeSession: jest.fn(),
    },
}));
jest.mock("../../services/api/attendanceApi", () => ({
    attendanceApi: { recordsBySession: jest.fn().mockResolvedValue([]), createRecord: jest.fn() },
}));

import { listBlocks } from "../../services/api/referenceData";
import { schedulingApi } from "../../services/api/schedulingApi";
import { useAttendanceKioskViewModel } from "../useAttendanceKioskViewModel";

function renderHook() {
    let vm;
    function Probe() {
        vm = useAttendanceKioskViewModel();
        return null;
    }
    act(() => { create(<Probe />); });
    return () => vm;
}

beforeEach(() => jest.clearAllMocks());

test("todaysBlocks only includes blocks for this instructor on today's ISO weekday", async () => {
    const isoToday = ((new Date().getDay() + 6) % 7) + 1; // getDay(): 0=domingo..6=sábado -> ISO 1..7
    listBlocks.mockResolvedValue([
        { scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: isoToday, cohortId: 10 },
        { scheduleBlockId: 2, instructorActorId: 99, dayOfWeek: isoToday, cohortId: 11 }, // otro profesor
        { scheduleBlockId: 3, instructorActorId: 7, dayOfWeek: isoToday === 1 ? 2 : 1, cohortId: 12 }, // otro día
    ]);
    const getVm = renderHook();

    await act(async () => {}); // deja resolver el efecto de carga

    expect(getVm().todaysBlocks.map((b) => b.scheduleBlockId)).toEqual([1]);
});

test("startClass creates today's session when none exists yet, then opens it", async () => {
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: 1, cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([]); // no hay sesión de hoy todavía
    schedulingApi.createSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Created" });
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    const getVm = renderHook();
    await act(async () => {});

    await act(async () => {
        await getVm().startClass(getVm().todaysBlocks[0]);
    });

    expect(schedulingApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ scheduleBlockId: 1 })
    );
    expect(schedulingApi.openSession).toHaveBeenCalledWith(55);
    expect(getVm().view).toBe("WAITING");
});

test("startClass reuses today's session and tolerates it already being Open", async () => {
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: 1, cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([{ classSessionId: 55, scheduleBlockId: 1, sessionStatus: "Open" }]);
    schedulingApi.openSession.mockRejectedValue({ status: 400, message: "ClassSession already Open" });
    const getVm = renderHook();
    await act(async () => {});

    await act(async () => {
        await getVm().startClass(getVm().todaysBlocks[0]);
    });

    expect(schedulingApi.createSession).not.toHaveBeenCalled();
    expect(getVm().view).toBe("WAITING");
    expect(getVm().session.classSessionId).toBe(55);
});

test("endClass closes the session and returns to SELECT_SESSION", async () => {
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: 1, cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([{ classSessionId: 55, scheduleBlockId: 1, sessionStatus: "Open" }]);
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    schedulingApi.closeSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Closed" });
    const getVm = renderHook();
    await act(async () => {});
    await act(async () => { await getVm().startClass(getVm().todaysBlocks[0]); });

    await act(async () => { await getVm().endClass(); });

    expect(schedulingApi.closeSession).toHaveBeenCalledWith(55);
    expect(getVm().view).toBe("SELECT_SESSION");
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js`
Expected: FAIL (`Cannot find module '../useAttendanceKioskViewModel'`).

- [ ] **Step 3: Implementar la parte A del hook**

Firma: `export function useAttendanceKioskViewModel()`. Internamente:
- `isoWeekday(date = new Date())`: `((date.getDay() + 6) % 7) + 1` (convierte `getDay()` 0=domingo..6=sábado al 1..7 ISO del DBML).
- Carga `listBlocks()` en un efecto al montar; `todaysBlocks` = filtrado por `instructorActorId === user.academicActorId && dayOfWeek === isoWeekday()`.
- `startClass(block)`:
  1. `const today = new Date().toISOString().slice(0, 10)`.
  2. `const sessions = await schedulingApi.listSessions()`; buscar una con `scheduleBlockId === block.scheduleBlockId && sessionDate === today` (`ClassSessionResponse.sessionDate`, serializado como `"YYYY-MM-DD"`).
  3. Si no existe, `session = await schedulingApi.createSession({ scheduleBlockId: block.scheduleBlockId, sessionDate: today })`; si existe, usar esa.
  4. `try { session = await schedulingApi.openSession(session.classSessionId) } catch (e) { if (e.status !== 400) throw e; /* ya estaba Open: seguir con la sesión ya cargada */ }`.
  5. Guardar `session` y `block` en el estado del hook, `view = "WAITING"`.
- `endClass()`: `await schedulingApi.closeSession(session.classSessionId)`; limpiar `session`/`block`, `view = "SELECT_SESSION"`.
- `view` inicial: `"SELECT_SESSION"`.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js`
Expected: PASS (las 4 pruebas de esta tarea).

- [ ] **Step 5: Commit**

```bash
git add front-end/Web/src/viewmodels/useAttendanceKioskViewModel.js front-end/Web/src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js
git commit -m "feat(web): add session lifecycle to the attendance kiosk viewmodel"
```

---

## Task 8: Frontend — `useAttendanceKioskViewModel`, parte B: captura, deduplicación y registro

**Files:**
- Modify: `front-end/Web/src/viewmodels/useAttendanceKioskViewModel.js`
- Modify: `front-end/Web/src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js`

**Interfaces:**
- Consumes: `connectBiometricSocket` (Tarea 3), `cohortActorByPerson` (Tarea 4), `attendanceApi.recordsBySession/createRecord` (Tarea 4), `useFaceCapture`/`useFingerprintReader` (Tareas 5/6, con el nuevo parámetro `socket`).
- Produces (se añade a la API del hook de la Tarea 7): `socket` (la instancia devuelta por `connectBiometricSocket`, `null` mientras `view === "SELECT_SESSION"` — la Tarea 9 la pasa tal cual a `useFaceCapture`/`useFingerprintReader`), `registeredActorIds: Set<number>`, `onIdentified(personId: string, { biometricType: "FACIAL"|"FINGERPRINT", score: number }): Promise<void>` (función pública del hook — es el callback que la Tarea 9 conecta al `onIdentified` de las Tareas 5/6), `onCaptureError(message: string): void` (pone `view = "ERROR"` con ese mensaje — la Tarea 9 la llama desde el `.catch()` de `loginFace()`/`loginFingerprint()` cuando rechazan, p. ej. "sin match"), y los estados `WAITING | CAPTURING_FACE | CAPTURING_FINGER | SUCCESS | DUPLICATE | ERROR` en `view`.

- [ ] **Step 1: Escribir los tests que fallan**

```js
// añadir al mismo archivo de la Tarea 7

jest.mock("../../services/ws/biometricSocket", () => ({ connectBiometricSocket: jest.fn() }));
import { connectBiometricSocket } from "../../services/ws/biometricSocket";
import { attendanceApi } from "../../services/api/attendanceApi";
import { cohortActorByPerson } from "../../services/api/referenceData";

async function startedVm({ enrolledPersonId = "person-a", academicActorId = 1 } = {}) {
    listBlocks.mockResolvedValue([{ scheduleBlockId: 1, instructorActorId: 7, dayOfWeek: 1, cohortId: 10 }]);
    schedulingApi.listSessions.mockResolvedValue([{ classSessionId: 55, scheduleBlockId: 1, sessionStatus: "Open" }]);
    schedulingApi.openSession.mockResolvedValue({ classSessionId: 55, sessionStatus: "Open" });
    cohortActorByPerson.mockResolvedValue(new Map([[enrolledPersonId, academicActorId]]));
    attendanceApi.recordsBySession.mockResolvedValue([]);
    connectBiometricSocket.mockReturnValue({ send: jest.fn(), onAttendanceEvent: jest.fn(), onStatusChange: jest.fn(), close: jest.fn() });

    const getVm = renderHook();
    await act(async () => {});
    await act(async () => { await getVm().startClass(getVm().todaysBlocks[0]); });
    return getVm;
}

test("a successful identify for an enrolled person creates the attendance record and shows SUCCESS", async () => {
    attendanceApi.createRecord.mockResolvedValue({ attendanceRecordId: 1 });
    const getVm = await startedVm();

    await act(async () => {
        await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 });
    });

    expect(attendanceApi.createRecord).toHaveBeenCalledWith({
        classSessionId: 55,
        academicActorId: 1,
        attendanceStatus: "Present",
        captureMethod: "FACIAL",
        matchScore: 0.95,
    });
    expect(getVm().view).toBe("SUCCESS");
});

test("identifying the same person twice in one session shows DUPLICATE without a second HTTP call", async () => {
    attendanceApi.createRecord.mockResolvedValue({ attendanceRecordId: 1 });
    const getVm = await startedVm();
    await act(async () => { await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 }); });

    await act(async () => { await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 }); });

    expect(attendanceApi.createRecord).toHaveBeenCalledTimes(1);
    expect(getVm().view).toBe("DUPLICATE");
});

test("a 409 from createRecord (race with another kiosk) is treated as DUPLICATE, not ERROR", async () => {
    attendanceApi.createRecord.mockRejectedValue({ status: 409, message: "duplicate" });
    const getVm = await startedVm();

    await act(async () => { await getVm().onIdentified("person-a", { biometricType: "FACIAL", score: 0.95 }); });

    expect(getVm().view).toBe("DUPLICATE");
});

test("a recognized person outside this cohort shows ERROR without creating a record", async () => {
    attendanceApi.createRecord.mockResolvedValue({});
    const getVm = await startedVm({ enrolledPersonId: "person-a" });

    await act(async () => { await getVm().onIdentified("person-outsider", { biometricType: "FACIAL", score: 0.95 }); });

    expect(attendanceApi.createRecord).not.toHaveBeenCalled();
    expect(getVm().view).toBe("ERROR");
});

test("onCaptureError shows ERROR with that message (e.g. no biometric match)", async () => {
    const getVm = await startedVm();

    act(() => { getVm().onCaptureError("no match found"); });

    expect(getVm().view).toBe("ERROR");
    expect(getVm().statusMessage).toBe("no match found");
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx jest src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js`
Expected: FAIL (las 5 pruebas nuevas; las de la Tarea 7 siguen en PASS).

- [ ] **Step 3: Implementar la parte B del hook**

- Al entrar a `WAITING` (tras `startClass`), si no existe ya: `const socket = connectBiometricSocket({})`, guardarlo en un ref; precargar `registeredActorIds` desde `attendanceApi.recordsBySession(session.classSessionId)` (mapear a `Set` de `academicActorId`); precargar `const actorByPerson = await cohortActorByPerson(block.cohortId)`.
- `onIdentified(personId, { biometricType, score })`, expuesta públicamente en el objeto que devuelve el hook:
  1. `const academicActorId = actorByPerson.get(personId)`.
  2. Si `academicActorId == null` → `view = "ERROR"`, mensaje "No pertenece a esta clase", `return`.
  3. Si `registeredActorIds.has(academicActorId)` → `view = "DUPLICATE"`, `return`.
  4. `try { await attendanceApi.createRecord({ classSessionId: session.classSessionId, academicActorId, attendanceStatus: "Present", captureMethod: biometricType, matchScore: score }); registeredActorIds.add(academicActorId); view = "SUCCESS"; } catch (e) { if (e.status === 409) { registeredActorIds.add(academicActorId); view = "DUPLICATE"; } else { view = "ERROR"; } }`.
  5. Tras `SUCCESS`/`DUPLICATE`/`ERROR`, programar con `setTimeout` el regreso a `view = "WAITING"` (la pantalla de la Tarea 9 es quien realmente dispara la siguiente captura; este hook solo gestiona el estado).
- `onCaptureError(message)`: `view = "ERROR"`, `statusMessage = message`; igual que los demás estados terminales, programa con `setTimeout` el regreso a `view = "WAITING"`.
- Cerrar el socket (`socket.close()`) dentro de `endClass()`, antes de llamar a `schedulingApi.closeSession`.
- Suscribir `socket.onAttendanceEvent` para, ante un evento de otro cliente, añadir su `academicActorId` (resuelto vía `actorByPerson`) a `registeredActorIds` — así un segundo kiosco en la misma sesión queda reflejado sin round-trip propio.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `npx jest src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js`
Expected: PASS (las 9 pruebas del archivo, Tareas 7 y 8 juntas).

- [ ] **Step 5: Commit**

```bash
git add front-end/Web/src/viewmodels/useAttendanceKioskViewModel.js front-end/Web/src/viewmodels/__tests__/useAttendanceKioskViewModel.test.js
git commit -m "feat(web): record attendance from identify events with local dedup"
```

---

## Task 9: Frontend — pantalla `AttendanceKioskScreen` / `AttendanceKioskView`

**Files:**
- Create: `front-end/Web/src/view/AttendanceKioskView.js`
- Create: `front-end/Web/src/view/screens/AttendanceKioskScreen.js`
- Test: `front-end/Web/src/view/screens/__tests__/AttendanceKioskScreen.test.js`

**Interfaces:**
- Consumes: `useAttendanceKioskViewModel()` (Tareas 7+8), `useFaceCapture({ vm, socket, onIdentified })`/`useFingerprintReader({ vm, socket, onIdentified })` (Tareas 5+6), `useRolePermissions()` (ya existe, igual que `BiometricsScreen.js`).
- Produces: `export default function AttendanceKioskScreen()` — sin props, igual que `BiometricsScreen.js`, para registrarse en el navigator (Tarea 10).

- [ ] **Step 1: Escribir el test que falla**

```js
// src/view/screens/__tests__/AttendanceKioskScreen.test.js
import React from "react";
import { create, act } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../../../viewmodels/useRolePermissions", () => ({
    useRolePermissions: () => ({ canRegisterFace: false }),
}));
jest.mock("@react-navigation/native", () => ({ useNavigation: () => ({}), useRoute: () => ({}) }));

import AttendanceKioskScreen from "../AttendanceKioskScreen";

test("blocks access when the user lacks canRegisterFace", () => {
    let tree;
    act(() => { tree = create(<AttendanceKioskScreen />); });
    expect(tree.toJSON()).toBeTruthy(); // renderiza el componente NotAuthorized, no crashea
});
```

(Prueba deliberadamente mínima — el resto de la pantalla es presentacional y se verifica manualmente según el plan de prueba de la Tarea 6 del spec; sigue el mismo nivel de cobertura que el resto de pantallas `view/screens/*` del proyecto, ninguna de las cuales tiene tests hoy más allá de este gate de permiso.)

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx jest src/view/screens/__tests__/AttendanceKioskScreen.test.js`
Expected: FAIL (`Cannot find module '../AttendanceKioskScreen'`).

- [ ] **Step 3: Implementar `AttendanceKioskScreen.js` y `AttendanceKioskView.js`**

`AttendanceKioskScreen.js` sigue el mismo esqueleto que `BiometricsScreen.js`: valida `permissions.canRegisterFace` con `useRolePermissions()`, si no lo tiene devuelve `<NotAuthorized type={AUTH_EXCEPTION_TYPES.INSUFFICIENT_PERMISSIONS} />`; si lo tiene, renderiza `<AttendanceKioskView />`.

`AttendanceKioskView.js` consume `useAttendanceKioskViewModel()` y, según `view`:
- `SELECT_SESSION`: lista `todaysBlocks` (reutilizar `Card`/`Button` de `view/components/common`), cada ítem llama a `startClass(block)`.
- `WAITING`/`CAPTURING_FACE`/`CAPTURING_FINGER`/`SUCCESS`/`DUPLICATE`/`ERROR`: banner grande con ícono (Feather) + texto corto por estado (usar los mismos nombres de estado como clave de un diccionario de mensajes, análogo a `statusConfig` en `InstructorAttendanceList.js`), botón "Usa tu huella" siempre visible salvo que `deviceReady` (de `useFingerprintReader`) sea `false`, botón "Finalizar clase" que llama a `endClass()`.
- Monta, solo mientras `view !== "SELECT_SESSION"` (mismo patrón de montaje condicional que ya usa `BiometricsView.js` para no retener cámara/lector fuera de su módulo):
  ```js
  const face = useFaceCapture({
      vm: kioskVm,
      socket: kioskVm.socket,
      onIdentified: (data) => kioskVm.onIdentified(data.person_id, { biometricType: "FACIAL", score: data.score }),
  });
  const fingerprint = useFingerprintReader({
      vm: kioskVm,
      socket: kioskVm.socket,
      onIdentified: (data) => kioskVm.onIdentified(data.person_id, { biometricType: "FINGERPRINT", score: data.score }),
  });
  ```
  `kioskVm.vm` que esperan estos dos hooks (el objeto con `run`/`setStatus`/`requirePersonId`/`refreshSummary`) no es `useAttendanceKioskViewModel()` en crudo — `requirePersonId`/`refreshSummary` no aplican aquí (no hay una persona preseleccionada como en `Biometrics`). Construir en esta vista un `vm` mínimo compatible: `{ run: (op) => op(), setStatus: () => {}, requirePersonId: () => null, refreshSummary: () => Promise.resolve(null) }` — el único uso real que hacen `loginFace`/`loginFingerprint` de `vm` es `run` (pasante aquí: no hay un estado `busy` propio de esta pantalla) y `setStatus` (se ignora: el estado visible lo gobierna `kioskVm.view`, no el `status` interno de estos hooks).

  El ciclo pasivo en `WAITING` y el botón "Usa tu huella" deben encadenar el error de la propia llamada (no capturado por el `vm.run` pasante) hacia `kioskVm.onCaptureError`:
  ```js
  face.loginFace().catch((e) => kioskVm.onCaptureError(e.message));
  // y, en el botón de huella:
  fingerprint.loginFingerprint().catch((e) => kioskVm.onCaptureError(e.message));
  ```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx jest src/view/screens/__tests__/AttendanceKioskScreen.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front-end/Web/src/view/AttendanceKioskView.js front-end/Web/src/view/screens/AttendanceKioskScreen.js front-end/Web/src/view/screens/__tests__/AttendanceKioskScreen.test.js
git commit -m "feat(web): add the attendance kiosk screen"
```

---

## Task 10: Frontend — conectar la navegación y el botón del Dashboard

**Files:**
- Modify: `front-end/Web/src/navegation/AuthenticatedNavigator.js`
- Modify: `front-end/Web/src/view/DashboardView.js`

**Interfaces:**
- Consumes: `AttendanceKioskScreen` (Tarea 9).
- Produces: ruta de navegación `"AttendanceKiosk"` navegable con `navigation.navigate("AttendanceKiosk")`.

- [ ] **Step 1: Registrar la ruta en `AuthenticatedNavigator.js`**

Import: `import AttendanceKioskScreen from "../view/screens/AttendanceKioskScreen";` junto a los demás imports de screens.

Añadir, junto al `Stack.Screen name="Biometrics"` (mismo comentario "sin ítem en la sidebar"):
```jsx
<Stack.Screen name="AttendanceKiosk">
    {(props) => <ScreenWithSidebar><AttendanceKioskScreen {...props} /></ScreenWithSidebar>}
</Stack.Screen>
```

- [ ] **Step 2: Cambiar el destino del botón en `DashboardView.js:886`**

`onPress={() => navigation.navigate("Biometrics")}` → `onPress={() => navigation.navigate("AttendanceKiosk")}`.

- [ ] **Step 3: Verificar manualmente (sin test automatizado — es conexión de navegación, igual que el resto de `ROUTE_MAP`, que tampoco tiene tests hoy)**

Levantar `npm run start` (Expo web), iniciar sesión como profesor/admin, confirmar que "Tomar asistencia" abre la pantalla nueva y no la de enrolamiento.

- [ ] **Step 4: Commit**

```bash
git add front-end/Web/src/navegation/AuthenticatedNavigator.js front-end/Web/src/view/DashboardView.js
git commit -m "feat(web): point \"Tomar asistencia\" at the new attendance kiosk"
```

---

## Verificación final de toda la rama

- [ ] `pytest back-end/06-ms-biometric/tests -v` — todo en verde, incluyendo las clases nuevas y las preexistentes.
- [ ] `cd front-end/Web && npx jest` — todo en verde.
- [ ] Ejecutar manualmente el plan de prueba de la sección 6 del spec (estudiante simulado, duplicado, caída del WS, cierre de clase).
- [ ] Mensaje de squash-merge de una línea para la rama completa (se entrega al usuario al terminar, no se commitea).
