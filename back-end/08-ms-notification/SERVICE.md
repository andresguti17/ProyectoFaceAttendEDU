# Notification Service — `08-ms-notification`

## 1. Responsabilidad

Gestionar tipos de alerta y alertas generadas automaticamente por el sistema sobre actores academicos. Servicio que consume eventos de otros servicios para disparar notificaciones.

## 2. Tablas

| Tabla | Descripcion | PK |
|-------|-------------|-----|
| `alert_type` | Catalogo de tipos de alerta | `alert_type_id` (SMALLINT) |
| `alert` | Alerta generada sobre un actor | `alert_id` (BIGINT) |

**Cross-context:**
- `alert.academic_actor_id` → `Academic.academic_actor.academic_actor_id`

## 3. Stack Tecnologico

### 3.1 Lenguaje y Framework

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Lenguaje | **TypeScript 5 / Node.js 20** | Mismo runtime que Academic y Configuration |
| Framework | **Fastify 5** | Router de alto rendimiento con validacion por esquema |
| SQL | **pg 8** | SQL parametrizado; el esquema y sus migraciones viven en Liquibase (`database/`) |
| Arquitectura | **Hexagonal** | Misma estructura que los demas servicios (`src/domain` + `src/infrastructure`) |

### 3.2 Dependencias Principales

```text
// package.json (dependencies)
fastify       ^5.12.7   // HTTP framework
pg            ^8.11.0   // Driver PostgreSQL
kafkajs       ^2.2.4    // Consumo de eventos Kafka
nodemailer    ^10.2.1   // Relay SMTP (canal de correo)
pino          ^9.14.0   // Structured logging
zod           ^4.6.7    // Validacion de payloads
```

### 3.3 Librerias Adicionales

| Libreria | Uso | Por que |
|----------|-----|---------|
| **kafkajs** | Consumo de eventos Kafka | Cliente Kafka en JS puro |
| **nodemailer** | Correo (SMTP) | Relay para `POST /api/v1/emails` |
| **pino** | Structured logging | Logs JSON de alto rendimiento |
| **zod** | Validacion | Validacion de request bodies y payloads |
| **fastify.inject** | Tests HTTP | Pruebas de rutas sin abrir puertos |

### 3.4 Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **Node.js 20 + npm** | Build (`tsc`), tests (`jest`), ejecucion (`npm run dev`) |
| **Docker** | Containerizacion (`node:20-slim`) |
| **VS Code** | IDE principal |
| **DBeaver** | Cliente PostgreSQL |
| **Postman / Bruno** | Testing REST |
| **MailHog / Mailtrap** | Testing de emails en desarrollo |
| **ESLint** | Linting automatico |

---

## 4. Endpoints

### 4.1 Tipos de Alerta

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/alert-types` | Crear tipo de alerta |
| GET | `/api/v1/alert-types/{id}` | Obtener tipo |
| PUT | `/api/v1/alert-types/{id}` | Actualizar tipo |
| GET | `/api/v1/alert-types` | Listar tipos |

### 4.2 Alertas

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/alerts` | Crear alerta manual |
| GET | `/api/v1/alerts/{id}` | Obtener alerta |
| PATCH | `/api/v1/alerts/{id}/resolve` | Resolver alerta |
| GET | `/api/v1/alerts?actorId={id}` | Alertas de un actor |
| GET | `/api/v1/alerts?typeId={id}` | Alertas por tipo |
| GET | `/api/v1/alerts?resolved={bool}` | Filtrar por estado |

### 4.3 Preferencias de Notificacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/notification-preferences/{actorId}` | Preferencias del actor |
| PUT | `/api/v1/notification-preferences/{actorId}` | Actualizar preferencias |

### 4.4 Correo (interno)

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/emails` | Envia un correo mediante una plantilla |

```json
{
  "to": "carolina.mendoza@example.com",
  "template": "verification_code",
  "data": { "code": "482913", "minutes": "10" }
}
```

- **Respuestas**: `202 {"status":"accepted"}` cuando el relay lo acepto,
  `202 {"status":"skipped","reason":"smtp_not_configured"}` cuando no hay
  `SMTP_HOST` (dev sin relay), `502 {"error":"DELIVERY_FAILED"}` si el relay
  rechaza el mensaje, `400` por payload invalido y `403` si
  `EMAIL_INTERNAL_TOKEN` esta definido y no llega el header `X-Internal-Token`.
- **Anti-relay**: el cliente no puede enviar asunto ni cuerpo libre; solo
  `template` (lista cerrada: `verification_code`) + `data`. Los valores se
  validan contra la inyeccion de sintaxis de plantilla.
- **Alcance**: consumido por **01-ms-identity** para los codigos de
  recuperacion de contrasena. La ruta **no esta publicada en Kong**: solo se
  alcanza por la red interna de compose (`http://ms-notification:8088`).
- **Plantillas**: `src/infrastructure/email/render.ts` (lista cerrada:
  `verification_code`).

---

## 5. Consumo de Eventos Kafka

El servicio Notification **consume** eventos de otros servicios para generar alertas:

```text
// Consumo de topicos de otros servicios
kafka.Consume(ctx, []string{
    "attendance-events", "scheduling-events",
    "configuration-events", "identity-events",
}, func(msg Event) {
    switch msg.Type {
    case "ABSENTEEISM_DETECTED":
        createAlert(ABSENTEEISM, msg)
    case "REPEATED_TARDINESS":
        createAlert(REPEATED_TARDINESS, msg)
    case "JUSTIFICATION_PENDING":
        createAlert(JUSTIFICATION_PENDING, msg)
    case "BIOMETRIC_UPDATE_REQUESTED":
        createAlert(BIOMETRIC_UPDATE, msg)
    }
})
```

### Topicos consumidos

| Topico | Eventos → Alertas |
|--------|-------------------|
| `attendance-events` | ABSENTEEISM_DETECTED, REPEATED_TARDINESS, LOW_ATTENDANCE |
| `scheduling-events` | CLASS_SESSION_CANCELLED |
| `configuration-events` | BIOMETRIC_UPDATE_REQUESTED, BIOMETRIC_UPDATE_REJECTED |
| `identity-events` | USER_AUTHENTICATION_FAILED (multiplas) |

---

## 6. Domain Events

| Evento | Trigger | Consumidores tipicos |
|--------|---------|---------------------|
| `AlertRaised` | Alerta generada | email/push service |
| `AlertResolved` | Alerta resuelta | — |
| `AlertTypeCreated` | Nuevo tipo de alerta | — |

---

## 7. Tipos de Alerta Predefinidos (Seeds)

| Codigo | Nombre | Descripcion |
|--------|--------|-------------|
| ABSENTEEISM | Ausentismo recurrente | Estudiante falta 3+ veces seguidas |
| REPEATED_TARDINESS | Tardanzas repetidas | Estudiante llega tarde 3+ veces seguidas |
| LOW_ATTENDANCE | Bajo porcentaje de asistencia | Asistencia < 75% |
| JUSTIFICATION_PENDING | Justificacion pendiente | Justificacion sin revisar por 48h+ |
| BIOMETRIC_UPDATE | Solicitud de actualizacion biom. | Nueva solicitud de actualizacion |

### Deteccion automatica

```
Attendance Service detecta patron
       │
       ▼
Kafka Event (ABSENTEEISM_DETECTED)
       │
       ▼
Notification Service genera alert
       │
       ├── Email al coordinador
       ├── Push al instructor
       └── Persistencia en alert (DB)
```

---

## 8. Canales de Notificacion

| Canal | Implementacion | Uso |
|-------|---------------|-----|
| **Email** | `nodemailer` + render propio (`src/infrastructure/email`) | Alertas formales, reportes, codigos de verificacion |
| **Push (FCM)** | firebase-admin (Node) | Notificaciones en tiempo real a movil |
| **SMS** | twilio (Node, opcional) | Alertas criticas, sin internet |
| **In-App** | SSE / WebSocket | Notificaciones dentro de la plataforma |

El canal **Email esta implementado** (endpoint interno `POST /api/v1/emails`,
ver §4.4). Push, SMS e In-App siguen pendientes. Las alertas aun no disparan
correo automatico: `alert` no tiene destinatario (solo `academic_actor_id`,
cross-context) y resolverlo implica consultar el correo en 01-ms-identity.

---

## 9. Configuracion

### config.yaml (ejemplo)

```yaml
server:
  port: 8088

database:
  host: localhost
  port: 5432
  name: faceattend_db
  user: postgres
  password: postgres
  schema: notification

kafka:
  brokers: localhost:9092
  group-id: notification-service

# Email: NO se configura aqui. El servicio lee variables de entorno (ver 9.1).
# SMTP_HOST vacio = canal deshabilitado y /api/v1/emails responde 202 "skipped".

# Firebase
firebase:
  config-path: ${FIREBASE_CONFIG_PATH:firebase-config.json}

# Canales de notificacion
notification:
  channels:
    email:
      enabled: true
    push:
      enabled: true
    sms:
      enabled: false
```

### 9.1 Variables de entorno del canal de correo

| Variable | Por defecto | Descripcion |
|----------|-------------|-------------|
| `SMTP_HOST` | *(vacia)* | Relay SMTP. Vacía = canal deshabilitado |
| `SMTP_PORT` | `587` | `465` activa implicitamente TLS directo (SMTPS) |
| `SMTP_USERNAME` | — | Usuario del relay (opcional) |
| `SMTP_PASSWORD` | — | Password del relay (opcional) |
| `SMTP_FROM` | `FaceAttend EDU <no-reply@faceattend.local>` | Remitente RFC 5322 |
| `SMTP_STARTTLS` | `true` | STARTTLS en puertos distintos de 465 |
| `SMTP_TIMEOUT_SECONDS` | `10` | Timeout de dial/handshake/IO |
| `EMAIL_INTERNAL_TOKEN` | *(vacia)* | Si se define, exige el header `X-Internal-Token` en `/api/v1/emails` |

En desarrollo basta apuntar a un MailHog local (`SMTP_HOST=host.docker.internal`,
`SMTP_PORT=1025`, `SMTP_STARTTLS=false`) para ver los correos en su UI.

### 9.2 Variables de entorno del webhook de alertas

`alert_type.channel` (EMAIL/PUSH/DASHBOARD) se guardaba pero nunca se
consultaba: crear una alerta no disparaba ninguna notificación externa.
Ahora, al crear una alerta cuyo `alert_type.channel` sea `EMAIL` o `PUSH`
(las `DASHBOARD` solo se muestran en la app, no requieren salida externa),
el servicio hace un POST JSON a `WEBHOOK_URL` en segundo plano (no bloquea
la respuesta del POST /api/v1/alerts).

| Variable | Por defecto | Descripcion |
|----------|-------------|-------------|
| `WEBHOOK_URL` | *(vacia)* | Endpoint que recibe el POST. Vacía = entrega deshabilitada (no-op) |
| `WEBHOOK_SECRET` | *(vacia)* | Si se define, firma el cuerpo con HMAC-SHA256 en el header `X-Webhook-Signature` |
| `WEBHOOK_TIMEOUT_SECONDS` | `5` | Timeout de la petición saliente |

Cuerpo del POST:

```json
{
  "alert_id": 123,
  "academic_actor_id": 45,
  "alert_type_id": 2,
  "alert_type_code": "ATTENDANCE_ABSENTEEISM",
  "severity": "WARNING",
  "channel": "EMAIL",
  "raised_at": "2026-10-08T14:32:00Z"
}
```

---

## 10. Puertos del Servidor

| Puerto | Servicio |
|--------|----------|
| 8088 | REST API |
| 9092 | Kafka (externo) |
| 5432 | PostgreSQL (externo) |
| 587 | SMTP (externo) |
| 443 | Firebase FCM (externo) |

---

## 11. Stack Actual

Notification esta implementado en **TypeScript 5 + Fastify 4** con arquitectura hexagonal (reescrito desde Go 1.22 + Gin; ver `STACK.md`).

### Justificacion

- **Mismo runtime que Academic y Configuration (Node 20)**: un solo stack TypeScript para los servicios ligeros de datos.
- **Fastify**: Router rapido con validacion por esquema.
- **pg**: SQL parametrizado sobre el schema `notification` (2 tablas: `alert_type`, `alert`).
- **Canal de correo**: `nodemailer` para el relay SMTP y render propio de plantillas; `firebase-admin` para push y `twilio` para SMS (pendientes).
- **kafkajs + pino**: Consumo de eventos de otros servicios con logs JSON estructurados.

