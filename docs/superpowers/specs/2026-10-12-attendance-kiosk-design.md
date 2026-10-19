# Kiosco de asistencia en una sola pantalla por WebSocket — Diseño

Fecha: 2026-10-12
Estado: Aprobado por el usuario (pendiente de plan de implementación)

## 1. Contexto y objetivo

Hoy el registro de asistencia por biometría no tiene un flujo de clase real:

- `06-ms-biometric` ya expone un canal WebSocket (`WS /api/v1/biometric/ws`,
  añadido en el commit `968da38`) pensado para eventos de asistencia en tiempo
  real, pero solo envuelve los endpoints **vectoriales** (`encoding: list[float]`)
  de `facial_router.py` / `fingerprint_router.py`.
- El flujo real de captura en `front-end/Web` usa los endpoints **de
  imagen/muestra**: reto de vida + imagen (`/liveness-challenge`,
  `/liveness-step`, `/identify-image`) para rostro, y muestra cruda PNG
  (`/identify-sample`) para huella (`useFaceCapture.js`, `useFingerprintReader.js`).
  Ninguno de los dos pasa hoy por el canal WS.
- No existe ninguna pantalla de "tomar asistencia": `BiometricsScreen.js` es
  una pantalla de **enrolamiento** (admin/profesor registra el rostro/huella
  de otra persona), no de verificación en vivo.
- `schedulingApi.openSession` / `closeSession` ya llaman a los endpoints reales
  de `04-ms-scheduling` (`POST /class-sessions/{id}/open|close`), pero ninguna
  pantalla los usa todavía.
- El botón "Tomar asistencia" ya existe en `DashboardView.js:886`, pero hoy
  navega a `Biometrics` (la pantalla de enrolamiento) como placeholder.
- `POST /attendance-records` en `05-ms-attendance` ya impone la regla de "una
  asistencia por actor y sesión" a nivel de base de datos
  (`DuplicateEntityException` ante `(classSessionId, academicActorId)` repetido).

Objetivo: que el profesor inicie la clase desde una pantalla web y, a partir de
ahí, cada estudiante se acerque y siga instrucciones breves en pantalla (rostro
o huella) sin usar teclado ni mouse, con estado en tiempo real y comunicación
por WebSocket entre navegador y servidor, reusando al máximo la lógica de
reconocimiento y almacenamiento existente.

## 2. Alcance

**Dentro de alcance:**
- `front-end/Web` (pantalla nueva, hooks, navegación, API clients).
- `back-end/06-ms-biometric` (dos tipos de mensaje WS nuevos).

**Fuera de alcance (explícitamente, para no inflar el cambio):**
- `front-end/Mobile`: el pedido es solo pantalla web.
- `04-ms-scheduling` y `05-ms-attendance`: se consumen tal cual están, sin
  tocar sus endpoints ni su modelo de datos.
- Enrolamiento biométrico (`facial.enroll` / `fingerprint.enroll` por WS,
  pantalla `Biometrics` existente): no cambia.
- Múltiples kioscos simultáneos en la misma sesión como caso principal (el
  diseño no lo impide — el fan-out de `attendance.event` ya cubre esa
  situación gratis — pero no se construye ni se prueba como caso primario).

## 3. Arquitectura general

```
Profesor: Dashboard → botón "Tomar asistencia" → AttendanceKioskScreen
   1. Lista los bloques horarios de HOY para el profesor
      (instructorActorId = user.academicActorId, dayOfWeek = ISO de hoy),
      derivados de listBlocks() (ya existe en referenceData.js).
   2. El profesor elige un bloque → se busca la class_session de hoy para ese
      scheduleBlockId; si no existe se crea (CreateClassSessionUseCase ya
      existe) → schedulingApi.openSession(id).
   3. Se abre UN WebSocket hacia ms-biometric
      (wss://.../api/v1/biometric/ws?token=<sesión>), vive mientras la
      pantalla esté montada para esta sesión.
   4. Máquina de estados del kiosco: SELECT_SESSION → WAITING →
      CAPTURING_FACE | CAPTURING_FINGER → SUCCESS | DUPLICATE | ERROR → WAITING.
   5. Profesor: "Finalizar clase" → cierra el socket → schedulingApi.closeSession(id).
```

Ningún servicio Java cambia. El navegador es quien conecta los tres contextos
(biometría, scheduling, attendance) — exactamente el mismo patrón que ya usa
el resto del frontend (cada `*Api.js` habla directo con su servicio vía Kong,
sin llamadas servicio-a-servicio).

## 4. Backend: extender `ws_router.py` (no reemplazar nada)

Se agregan dos tipos de mensaje nuevos al envelope existente
(`{"type": ..., "client_message_id": ..., "direction": ..., "payload": {...}}`),
siguiendo el mismo patrón de reutilización que ya usan `facial.identify` /
`fingerprint.identify`: llamar directamente a la corutina del router REST
correspondiente, sin duplicar matching ni reglas de negocio.

| `type` nuevo | Envuelve | Payload |
|---|---|---|
| `facial.identify_image` | `facial_router.identify_facial_image` | `{image_base64, challenge_token}` |
| `fingerprint.identify_sample` | `fingerprint_router.identify_fingerprint_sample` | `{sample_format, data_base64, quality, finger_number}` |

Reglas:
- El reto de vida (`GET /liveness-challenge`, `POST /liveness-step`) **sigue
  siendo REST** — es inherentemente multi-paso (varios gestos, varios frames
  por gesto) y no es un evento de asistencia en sí mismo. El navegador lo
  resuelve exactamente igual que hoy en `useFaceCapture.js`; solo el mensaje
  final de identificación viaja por el socket.
- Ambos tipos nuevos emiten `attendance.event` al resto de conexiones en éxito
  (mismo mecanismo de `ConnectionManager.broadcast` ya existente) — gratis,
  sin código nuevo de fan-out.
- `facial.enroll` / `fingerprint.enroll` por WS **no se agregan** — el
  enrolamiento sigue siendo solo REST, vía la pantalla admin existente.
- Mismos modelos Pydantic que ya usan `identify_facial_image` /
  `identify_fingerprint_sample` — no se inventan payloads nuevos.
- Se documenta en `SERVICE.md` (sección 4.5) igual que los tipos existentes.

## 5. Frontend

### 5.1 Cliente WebSocket

Archivo nuevo `services/ws/biometricSocket.js`:
- Conecta a `ws(s)://<base>/api/v1/biometric/ws?token=<token>`, derivando el
  esquema/host a partir de la URL base de Kong ya resuelta por `apiClient.js`
  (se exporta `resolveBaseUrl()`, hoy privada, para reutilizarla — sin
  duplicar esa lógica).
- Heartbeat: envía `{"type": "ping"}` cada ~20s (antes del
  `BIOMETRIC_WS_IDLE_TIMEOUT_SECONDS` de 60s del servidor).
- Reconexión automática con backoff ante cierre/caída.
- Mapa de solicitudes pendientes por `client_message_id`: cada `send(type, payload)`
  devuelve una promesa que se resuelve con el `.ack` o se rechaza con el
  frame `error` correspondiente.
- Emite un evento local `attendance.event` para quien quiera escucharlo (la
  propia pantalla, para refrescar su set de "ya registrados").
- Reenvía con el mismo `client_message_id` tras una reconexión a medio
  mensaje — la caché de idempotencia del servidor evita un doble registro.

### 5.2 Máquina de estados

Archivo nuevo `viewmodels/useAttendanceKioskViewModel.js`:
- Estados: `SELECT_SESSION`, `WAITING`, `CAPTURING_FACE`, `CAPTURING_FINGER`,
  `SUCCESS`, `DUPLICATE`, `ERROR`.
- En `WAITING`, arranca automáticamente un ciclo pasivo de captura facial
  (cámara + liveness, reusando `useFaceCapture`). Un botón grande y siempre
  visible "Usa tu huella" permite cambiar a `CAPTURING_FINGER` en cualquier
  momento, y es la única vía si la cámara no está disponible.
- Cada hook de captura (`useFaceCapture`, `useFingerprintReader`) se modifica
  **mínimamente**: el método final de identificación recibe el socket en vez
  de llamar a `biometricCaptureApi.identifyFace` / `identifyFingerprint` por
  REST — el resto de la lógica (cámara, liveness, lector DigitalPersona) no
  cambia.
- Tras un `facial.identify_image.ack` / `fingerprint.identify_sample.ack`
  exitoso, resuelve `academicActorId` desde `person_id` (ver 5.4), chequea
  duplicado local, y si corresponde llama a `attendanceApi.createRecord(...)`.

### 5.3 Pantalla y navegación

- `view/screens/AttendanceKioskScreen.js` + `view/AttendanceKioskView.js`:
  banner de estado grande, ícono/animación grande, texto imperativo corto
  (≤ 4-5 palabras, legible a distancia). Sin texto largo.
- `AuthenticatedNavigator.js`: nuevo `Stack.Screen name="AttendanceKiosk"`
  (mismo patrón "sin ítem en la sidebar" que ya usa `Biometrics`).
- `DashboardView.js:886`: `navigation.navigate("Biometrics")` →
  `navigation.navigate("AttendanceKiosk")`. El gate de permiso sigue siendo
  `permissions.canRegisterFace` (mismos roles admin/profesor, sin cambios en
  `useRolePermissions.js`).

### 5.4 Resolución persona → asistencia, y anti-duplicado

1. Al montar la pantalla para una sesión, se construye una sola vez
   `{personId → academicActorId}` acotado a la cohorte del bloque
   (`listEnrollments()` filtrado por `cohortId` + `actorMap()`, ambos ya
   cacheados en `referenceData.js`), y se precarga el set de actores ya
   presentes vía `attendanceApi.recordsBySession(sessionId)`.
2. Tras un identify exitoso: si `person_id` no mapea a un `academicActorId`
   de esta cohorte → `ERROR` ("No pertenece a esta clase"), sin registrar.
3. Si el `academicActorId` ya está en el set local → `DUPLICATE`, sin
   llamada HTTP.
4. Si no, `attendanceApi.createRecord({classSessionId, academicActorId,
   attendanceStatus: "Present", captureMethod: "FACIAL"|"FINGERPRINT",
   matchScore})` (método nuevo, una línea, en `attendanceApi.js` — el
   endpoint Java `POST /attendance-records` ya existe y ya valida todo).
   Un 409 (carrera entre dos kioscos) se trata igual que `DUPLICATE`, nunca
   como error de usuario.
5. En éxito: se agrega al set local y se muestra `SUCCESS` ~2s antes de
   volver a `WAITING`.

## 6. Manejo de errores

- **Caída del WebSocket**: reconexión automática con backoff; la pantalla
  muestra un banner pequeño no bloqueante ("Reconectando…") y se queda en
  `WAITING` — nunca una pantalla congelada.
- **Hardware no disponible** (cámara sin permiso, runtime DigitalPersona
  caído): se oculta/deshabilita solo esa modalidad (mismos chequeos
  `CAMERA_SUPPORTED` / `readerError` que ya existen), la otra sigue usable.
- **Sin match / liveness fallida**: `ERROR` ~2s con mensaje corto de
  reintento, vuelve solo a `WAITING` — nunca bloquea al siguiente estudiante.
- **Persona no matriculada en la cohorte**: mismo tratamiento que "sin
  match", mensaje distinto.

## 7. Plan de prueba manual (con estudiante simulado)

1. Enrolar rostro/huella de una persona de prueba vía la pantalla
   `Biometrics` admin existente (sin cambios).
2. Como su profesor: Dashboard → "Tomar asistencia" → elegir el bloque de
   hoy → iniciar clase.
3. Como "estudiante": mirar a la cámara (ciclo pasivo automático) o presionar
   "Usa tu huella" → confirmar `SUCCESS` y que
   `GET /attendance-records?classSessionId=...` ya tiene la fila.
4. Repetir de inmediato con la misma persona → confirmar `DUPLICATE`, sin
   fila nueva.
5. Apagar el contenedor de `06-ms-biometric` a mitad de clase → confirmar
   "Reconectando…" sin congelar la pantalla; levantarlo de nuevo → confirmar
   recuperación sin recargar la página.
6. "Finalizar clase" → confirmar cierre del socket (dev tools) y
   `class_session.session_status = Closed`.

## 8. Fuera de alcance / deuda conocida (no se resuelve en este cambio)

- Multi-kiosco simultáneo por sesión: el fan-out de `attendance.event` ya lo
  soporta a nivel de protocolo, pero no se construye UI para un segundo
  dispositivo ni se prueba ese caso.
- El registro de conexiones WS y la caché de idempotencia de
  `06-ms-biometric` siguen en memoria de un solo proceso (límite ya
  documentado en `SERVICE.md`); no cambia con este trabajo.
- Mobile no se toca.
