# Biometric Service — `06-ms-biometric`

## 1. Responsabilidad

Gestionar plantillas biometricas (facial y dactilar). Servicio **hibrido SQL + NoSQL** que maneja el enrollment, verificacion e identificacion biométrica, asi como el flujo de aprobacion de actualizaciones.

## 2. Tablas y Colecciones

### SQL (schema `biometric`)

| Tabla | Descripcion | PK |
|-------|-------------|-----|
| *(schema vacio)* | Solo el esquema, tablas en Configuration | - |

**Nota:** `biometric_update_case` vive en el schema `configuration`, gestionada por `08-ms-configuration`.

### NoSQL (MongoDB)

| Coleccion | Descripcion |
|-----------|-------------|
| `facial_embedding` | Plantillas faciales (encoding, modelo, version) |
| `fingerprint_embedding` | Plantillas dactilares (dedo, encoding, modelo, version) |

**Cross-paradigm:** `biometric_update_case.current_embedding_ref` referencia documentos en MongoDB (sin FK real).

## 3. Stack Tecnologico

### 3.1 Lenguaje y Framework

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Lenguaje | **Python 3.12** | Ecosistema nativo de ML/vision artificial |
| Framework | **FastAPI** | Async I/O, OpenAPI automatico, validacion con Pydantic |
| Arquitectura | **Hexagonal** | Misma estructura |
| ML/CV | **OpenCV + NumPy** | Procesamiento de imagen, embeddings y distancias |

### 3.2 Dependencias Principales

```toml
# pyproject.toml
[tool.poetry.dependencies]
python = "^3.12"
fastapi = "^0.110.0"          # HTTP framework
uvicorn = "^0.28.0"           # ASGI server
pydantic = "^2.6.0"           # Validacion de schemas
pydantic-settings = "^2.1.0"  # Configuracion
motor = "^3.3.0"              # MongoDB driver async
pymongo = "^4.6.0"            # MongoDB driver
opencv-python = "^4.9.0"      # Computer vision
numpy = "^1.26.0"             # Vectores/embeddings
python-multipart = "^0.0.9"   # Upload de imagenes
structlog = "^24.1.0"         # Structured logging
httpx = "^0.27.0"             # Client HTTP
```

### 3.3 Librerias Recomendadas Adicionales

| Libreria | Uso | Por que |
|----------|-----|---------|
| **OpenCV (cv2)** | Procesamiento de imagen facial | Deteccion de rostros y preprocesamiento |
| **OpenCV DNN** | Inferencia de modelos | Carga de modelos ONNX (FaceNet/ArcFace) |
| **NumPy** | Algebra de vectores | Distancia coseno/coseno entre embeddings |
| **Motor** | MongoDB async | Persistencia de embeddings |
| **Pydantic** | Validacion de schemas | Modelos de request/response type-safe |
| **Structlog** | Logging estructurado | Logs JSON de alta legibilidad |
| **Redis** | Cache de embeddings activos | Verificacion rapida sin consultar MongoDB |
| **Testcontainers** | Tests de integracion | MongoDB en tests |

### 3.4 Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **Poetry** | Gestion de dependencias y builds |
| **Uvicorn** | Servidor ASGI |
| **Docker** | Containerizacion |
| **VS Code / PyCharm** | IDE |
| **MongoDB Compass** | Cliente grafico para MongoDB |
| **Postman / Bruno** | Testing REST |
| **Jupyter (opcional)** | Exploracion de modelos ML |

---

## 4. Endpoints

### 4.1 Enrollment Facial

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/biometric/facial/enroll` | Registrar plantilla facial |
| GET | `/api/v1/biometric/facial/{personId}` | Obtener plantilla activa |
| DELETE | `/api/v1/biometric/facial/{personId}` | Eliminar plantilla facial |
| GET | `/api/v1/biometric/facial/{personId}/history` | Historial de versiones |

### 4.2 Enrollment Dactilar

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/biometric/fingerprint/enroll` | Registrar plantilla dactilar |
| GET | `/api/v1/biometric/fingerprint/{personId}` | Obtener plantillas activas |
| GET | `/api/v1/biometric/fingerprint/{personId}/{finger}` | Plantilla de dedo especifico |
| DELETE | `/api/v1/biometric/fingerprint/{personId}/{finger}` | Eliminar plantilla dactilar |

### 4.3 Verificacion/Identificacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/biometric/facial/verify` | Verificar 1:1 (persona + imagen) |
| POST | `/api/v1/biometric/facial/identify` | Identificar 1:N (imagen contra todos) |
| POST | `/api/v1/biometric/fingerprint/verify` | Verificar 1:1 dactilar |

### 4.4 Actualizaciones (via Configuration)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/biometric/update-request` | Solicitar actualizacion de plantilla |
| GET | `/api/v1/biometric/update-requests/{personId}` | Solicitudes de una persona |

### 4.5 Canal WebSocket (tiempo real, convive con REST)

`WS /api/v1/biometric/ws` — canal adicional, **no reemplaza** ningun endpoint
REST de 4.1-4.3. No hay una segunda copia de las reglas de negocio: cada
mensaje llama directamente a las funciones de los routers REST
(`facial_router.enroll_facial/verify_facial/identify_facial` y sus pares de
`fingerprint_router`), con una sesión/permiso resueltos para el socket en vez
de por request — así un enroll por REST se puede identificar por WS y
viceversa, sin divergencia posible entre los dos caminos.

Un solo mensaje JSON de texto por frame: `{"type": "...", "client_message_id": "...", "payload": {...}}`.

| `type` | Equivalente REST | Respuesta |
|--------|-------------------|-----------|
| `facial.enroll` / `fingerprint.enroll` | `POST .../enroll` | `<type>.ack` con el template persistido |
| `facial.verify` / `fingerprint.verify` | `POST .../verify` | `<type>.ack` con `{match, score}` |
| `facial.identify` / `fingerprint.identify` | `POST .../identify` | `<type>.ack`; además dispara `attendance.event` a todas las **demás** conexiones activas |
| `facial.identify_image` | `POST .../facial/identify-image` | `<type>.ack`; dispara `attendance.event` |
| `fingerprint.identify_sample` | `POST .../fingerprint/identify-sample` | `<type>.ack`; dispara `attendance.event` |
| `ping` | — | `pong` (latido) |

`payload` se valida con el mismo modelo Pydantic que usa el router REST
correspondiente (`EnrollFacialRequest`, `IdentifyFingerprintRequest`, etc.) —
un mensaje inválido responde `{"type": "error", "error": "BadRequest", ...}`
sin cerrar la conexión. Fuera de alcance deliberadamente: los endpoints de
enrolamiento por imagen/muestra y el reto de vida (`/enroll-image`,
`/enroll-sample`, `/liveness-challenge`, `/liveness-step`) — son un flujo de UI
de varios pasos, no un evento único de asistencia, y siguen siendo solo REST.
El reto de vida sigue siendo exclusivamente REST incluso para clientes que usan
`facial.identify_image`: el `challenge_token` completado se obtiene por REST y
se envía en el mensaje WS.

`attendance.event` lleva `person_id`, `biometric_type`, `event_type`
(`CHECK_IN` / `CHECK_OUT`, tomado del `direction` del mensaje `identify`, o
`FACIAL_ENROLLED` / `FINGERPRINT_ENROLLED` para un enroll) y `timestamp` —
es la notificación en tiempo real de "quién fue registrado".

**Auth:** misma sesión + permiso `attendance.record:write` que REST
(`infrastructure/web/security.py`). El navegador no puede fijar cabeceras en
el handshake de WS, así que el token viaja como `?token=<session-uuid>`
(también se acepta `Authorization: Bearer` para clientes no-browser). Un
token inválido o sin permiso cierra el socket con un código 4401/4403/4503
(mismo significado que 401/403/503 en REST).

**Heartbeat / reconexión:** el cliente debe enviar `{"type": "ping"}`
periódicamente (recibe `pong`); una conexión que no envía nada durante
`BIOMETRIC_WS_IDLE_TIMEOUT_SECONDS` (60s por defecto) se cierra con código
1001. Si la conexión cae, el cliente reconecta y puede reenviar el último
mensaje con el mismo `client_message_id`: el servidor guarda la respuesta de
cada mensaje por `client_message_id` (`BIOMETRIC_WS_IDEMPOTENCY_TTL_SECONDS`,
300s por defecto) y la repite en vez de reprocesar — así un enroll o un
identify no se duplica ni se pierde por una reconexión.

**Límite conocido:** el registro de conexiones y la caché de idempotencia son
en memoria de este proceso (no hay un segundo réplica ni Redis detrás); con
una sola instancia en `docker-compose.yml` es correcto, y queda documentado
para no asumir fan-out entre réplicas.

---

## 5. Domain Events

| Evento | Trigger | Consumidores tipicos |
|--------|---------|---------------------|
| `FacialEnrolled` | Plantilla facial registrada | — |
| `FingerprintEnrolled` | Plantilla dactilar registrada | — |
| `FacialVerificationSucceeded` | Verificacion 1:1 exitosa | Attendance (registrar asistencia) |
| `FacialVerificationFailed` | Verificacion 1:1 fallida | Notification |
| `BiometricUpdateRequested` | Solicitud de actualizacion | Configuration, Notification |

---

## 6. Arquitectura Hibrida

```
┌─────────────────────────────────────────────────┐
│                BIOMETRIC SERVICE                 │
├────────────────────┬────────────────────────────┤
│   SQL (PostgreSQL) │   NoSQL (MongoDB)          │
│                    │                            │
│   biometric schema │   facial_embedding         │
│   (schema vacio)   │   fingerprint_embedding    │
│                    │                            │
├────────────────────┴────────────────────────────┤
│              INFERENCIA ML                      │
│                                                 │
│   OpenCV → Preprocesamiento de imagen           │
│   OpenCV DNN → FaceNet/ArcFace (modelo ONNX)    │
│   Distancia coseno → Comparacion de embeddings  │
└─────────────────────────────────────────────────┘
```

### Estructura de un embedding facial

```json
{
  "person_id": "uuid",
  "template_version": 2,
  "encoding": [0.012, -0.034, ...],
  "model_version": "facenet-v1",
  "enrolled_at": "2026-01-15T10:30:00Z",
  "is_active": true
}
```

### Estructura de un embedding dactilar

```json
{
  "person_id": "uuid",
  "finger_number": 1,
  "template_version": 1,
  "encoding": [0.123, 0.456, ...],
  "model_version": "fingerprint-v1",
  "enrolled_at": "2026-01-15T10:35:00Z",
  "is_active": true
}
```

---

## 7. Modelos de ML Recomendados

| Modelo | Tipo | Precision | Uso |
|--------|------|-----------|-----|
| **FaceNet** | Facial | 99.63% (LFW) | Generacion de embeddings faciales |
| **ArcFace** | Facial | 99.83% (LFW) | Generacion de embeddings faciales (state-of-art) |
| **MobileFaceNet** | Facial | 99.55% | Optimizado para movil/edge |
| **OpenFace** | Facial | 99.35% | Open source, ligero |
| **DeepPrint** | Dactilar | 98%+ | Embeddings dactilares |

---

## 8. Configuracion

### .env (ejemplo)

```bash
PORT=8086
MONGODB_URI=mongodb://localhost:27017/faceattend_biometric
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=biometric-service

# Configuracion ML
BIOMETRIC_FACIAL_MODEL_PATH=models/facenet.onnx
BIOMETRIC_FACIAL_EMBEDDING_SIZE=128
BIOMETRIC_CONFIDENCE_THRESHOLD=0.85
BIOMETRIC_SIMILARITY_THRESHOLD=0.90
BIOMETRIC_FINGERPRINT_MODEL_PATH=models/fingerprint.onnx
BIOMETRIC_FINGERPRINT_EMBEDDING_SIZE=256
```

---

## 9. Puertos del Servidor

| Puerto | Servicio |
|--------|----------|
| 8086 | REST API |
| 9092 | Kafka (externo) |
| 5432 | PostgreSQL (externo) |
| 27017 | MongoDB (externo) |
| 6379 | Redis (externo, cache) |

---

## 10. Stack Actual

Biometric esta implementado en **Python 3.12 + FastAPI** con arquitectura hexagonal. El servicio gestiona enrollment, verificacion e identificacion biometrica usando MongoDB para embeddings y PostgreSQL para el schema de casos.

### Justificacion

- **OpenCV + NumPy**: Procesamiento de imagen y algebra de vectores
- **OpenCV DNN**: Inferencia de modelos FaceNet/ArcFace (ONNX)
- **FastAPI**: Async I/O para manejo de imagenes y embeddings
- **MongoDB (Motor)**: Almacenamiento de embeddings vectoriales
- **Structlog**: Logs JSON estructurados
