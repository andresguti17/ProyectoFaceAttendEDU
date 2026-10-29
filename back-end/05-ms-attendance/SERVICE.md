# Attendance Service — `05-ms-attendance`

## 1. Responsabilidad

Registro de asistencia con multiples fuentes (reconocimiento facial, manual, huella, importacion), justificaciones de inasistencia/tardanza y gestion de documentos de soporte.

## 2. Tablas

| Tabla | Descripcion | PK |
|-------|-------------|-----|
| `attendance_record` | Un registro por actor y sesion | `attendance_record_id` (BIGINT) |
| `justification_type` | Catalogo de tipos de justificacion | `justification_type_id` (INT) |
| `justification` | Justificacion de inasistencia/tardanza | `justification_id` (BIGINT) |
| `supporting_document` | Soportes documentales adjuntos | `supporting_document_id` (BIGINT) |
| `attendance_report` | Proyeccion derivada (JSONB, sin FKs) | `report_id` (UUID) |

**Cross-context:**
- `attendance_record.class_session_id` → `Scheduling.class_session.class_session_id`
- `attendance_record.academic_actor_id` → `Academic.academic_actor.academic_actor_id`
- `justification.reviewed_by` → `Identity.app_user.user_id`

## 3. Stack Tecnologico

### 3.1 Lenguaje y Framework

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Lenguaje | **Java 21** | Consistencia con el proyecto |
| Framework | **Spring Boot 4.1.2** | Ecosistema unificado |
| Arquitectura | **Hexagonal** | Misma estructura |
| API alternativa | **Spring WebFlux** (opcional) | Endpoint reactivo para registro en tiempo real |

### 3.2 Dependencias Principales

```xml
<!-- Core -->
spring-boot-starter-webmvc
spring-boot-starter-data-jpa
spring-boot-starter-security
spring-boot-starter-validation
spring-boot-starter-actuator
spring-boot-starter-kafka
spring-boot-starter-liquibase

<!-- Reactivo (opcional) -->
spring-boot-starter-webflux

<!-- Persistencia -->
postgresql

<!-- Almacenamiento de archivos -->
spring-boot-starter-web  <!-- multipart handling -->

<!-- API Documentation -->
springdoc-openapi-starter-webmvc-ui

<!-- Utilidades -->
lombok
mapstruct
mapstruct-processor
```

### 3.3 Librerias Recomendadas Adicionales

| Libreria | Uso | Por que |
|----------|-----|---------|
| **MapStruct** | Mapeo DTO <-> Entity | Type-safe |
| **Lombok** | Boilerplate reduction | Reduce codigo |
| **Apache Tika** | Deteccion de tipos MIME | Validar tipos de archivos adjuntos |
| **Spring WebFlux** | Endpoint reactivo | Para registro de asistencia en tiempo real |
| **MinIO Client** | Almacenamiento S3-compatible | Almacenar documentos de soporte |
| **AWS SDK S3** | Almacenamiento en nube | Alternativa a MinIO |
| **Testcontainers** | Tests de integracion | PostgreSQL real |

### 3.4 Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **Maven** | Build tool |
| **Docker** | Containerizacion |
| **IntelliJ IDEA** | IDE |
| **DBeaver** | Cliente PostgreSQL |
| **Postman / Bruno** | Testing REST |
| **MinIO Console** | Gestion de archivos almacenados |

---

## 4. Endpoints

### 4.1 Registro de Asistencia

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/attendance-records` | Registrar asistencia (FACIAL/MANUAL/FINGERPRINT/IMPORT); el servidor decide Present/Late (ver §6) |
| POST | `/api/v1/attendance-records/bulk` | Registrar varios (mismas reglas, una fila por actor) |
| GET | `/api/v1/attendance-records` | Listar (filtros `classSessionId`, `academicActorId`, `attendanceStatus`; paginado) |
| GET | `/api/v1/attendance-records/summary?academicActorIds=` | Conteos por actor (hasta 300 ids) |
| GET | `/api/v1/attendance-records/{id}` | Obtener registro |
| PUT | `/api/v1/attendance-records/{id}` | Corregir registro (corrección manual del instructor: el estado enviado se respeta) |
| DELETE | `/api/v1/attendance-records/{id}` | Eliminar registro |
| GET | `/api/v1/class-sessions/{sessionId}/attendance` | Asistencia de una sesion |
| GET | `/api/v1/academic-actors/{actorId}/attendance` | Historial de asistencia de un actor |

### 4.2 Tipos de Justificacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/justification-types` | Listar tipos de justificacion |
| GET | `/api/v1/justification-types/{id}` | Obtener tipo |

### 4.3 Justificaciones

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/justifications` | Crear justificacion |
| GET | `/api/v1/justifications/{id}` | Obtener justificacion |
| PATCH | `/api/v1/justifications/{id}/review` | Revisar (Approved/Rejected) |
| GET | `/api/v1/attendance/{recordId}/justification` | Justificacion de un registro |
| GET | `/api/v1/justifications?status=Pending` | Justificaciones pendientes |

### 4.4 Documentos de Soporte

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/justifications/{justId}/documents` | Subir el archivo (`multipart/form-data`, parte `file`): PDF, JPG o PNG de hasta 5 MB. Permiso `attendance.justification:request` y alcance de la justificación |
| GET | `/api/v1/justifications/{justId}/documents` | Listar documentos (metadatos) |
| GET | `/api/v1/supporting-documents/{id}/content` | Archivo guardado (`inline`, `nosniff`, `no-store`). 404 si la fila es anterior a la subida real |
| DELETE | `/api/v1/supporting-documents/{id}` | Eliminar el registro y su objeto en MinIO |
| POST | `/api/v1/supporting-documents` | (Heredado) solo metadatos; se mantiene para APK antiguos |

- El tipo se determina por los primeros bytes del archivo (no por el nombre ni el `Content-Type` del cliente).
- La clave del objeto la genera el servidor: `justification-documents/{yyyy}/{MM}/{uuid}.{ext}` (ADR-009).
- Si falla el guardado de la fila, el objeto se borra (sin huérfanos). Errores: 400 tipo/tamaño, 413 más de 5 MB, 503 almacenamiento caído.

---

## 5. Domain Events

| Evento | Trigger | Consumidores tipicos |
|--------|---------|---------------------|
| `AttendanceRecorded` | Asistencia registrada | Notification |
| `AttendanceStatusChanged` | Estado de asistencia cambia | — |
| `JustificationSubmitted` | Justificacion enviada | Notification |
| `JustificationApproved` | Justificacion aprobada | Attendance (actualizar registro) |
| `JustificationRejected` | Justificacion rechazada | Notification |

---

## 6. Metodos de Captura

| Metodo | Descripcion | Flujo |
|--------|-------------|-------|
| **FACIAL** | Reconocimiento facial automatico | Biometric verifica → Attendance registra |
| **MANUAL** | Instructor registra manualmente | Instructor selecciona → Attendance registra |
| **FINGERPRINT** | Lector de huella dactilar del kiosco | Kiosco identifica → Attendance registra |
| **IMPORT** | Carga masiva por API (`/attendance-records/bulk`); no es un metodo del kiosco | Archivo procesado → Attendance registra |

### Estados de asistencia

| Estado | Descripcion |
|--------|-------------|
| Present | Asistencia confirmada |
| Absent | Inasistencia sin justificar |
| Late | Tardanza (llegada despues del inicio mas la tolerancia de la sede) |
| Justified | Inasistencia/tardanza justificada |

### Presente o Tarde lo decide el servidor (N-14)

Al crear un registro con estado `Present` o `Late` (por `POST /attendance-records` o `/bulk`), attendance
ignora el estado que envia el cliente:

1. Fija `captured_at` con su propio reloj.
2. Pide a scheduling la sesion (`sessionDate`) y su bloque (`startsAt`, `environmentId`), y el ambiente
   (`schoolId`); a configuration, `GET /schools/{schoolId}/configurations` → `tardy_tolerance_minutes`
   (15 si la sede no la tiene o no es un numero valido). Usa el bearer de quien llama, asi que solo
   resuelve sesiones que ese usuario ya puede ver.
3. Si la captura es posterior a `sessionDate + startsAt + tolerancia` (zona `faceattend.attendance.zone`,
   America/Bogota por defecto) el registro queda `Late`; si no, `Present`.

La ventana se guarda en memoria un minuto por sesion. Errores: sesion inexistente o ajena → 400;
scheduling o configuration no responden → 503 y no se guarda nada (nunca un estado adivinado).
`Absent` y `Justified` se guardan tal cual (los crea notification al cerrar la clase, o una correccion).

---

## 7. Flujo de Justificacion

```
attendance_record (Absent/Late)
       │
       ▼
justification (submitted)
       │
       ├── requires_attachment = true?
       │       │
       │       ▼
       │   supporting_document (adjunto obligatorio)
       │
       ▼
justification (Pending)
       │
       ├── APPROVED ──> attendance_record.status = Justified
       │
       └── REJECTED ──> attendance_record.status = Absent/Late (sin cambio)
```

---

## 8. Configuracion

### application.yml (ejemplo)

```yaml
server:
  port: 8085

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/faceattend_db
    username: postgres
    password: postgres
    hikari:
      schema: attendance
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate.default_schema: attendance
  servlet:
    multipart:
      max-file-size: 5MB
      max-request-size: 6MB
  kafka:
    bootstrap-servers: localhost:9092
    group-id: attendance-service

# Almacenamiento de documentos (MinIO, ADR-009). Credenciales solo por entorno:
# FACEATTEND_STORAGE_ACCESS_KEY / FACEATTEND_STORAGE_SECRET_KEY.
faceattend:
  storage:
    endpoint: http://localhost:9000
    bucket: justification-documents
  auth:
    identity-url: http://localhost:8081       # FACEATTEND_AUTH_IDENTITY_URL
    authorization-url: http://localhost:8082  # FACEATTEND_AUTH_AUTHORIZATION_URL
    academic-url: http://localhost:8083       # FACEATTEND_AUTH_ACADEMIC_URL (alcance por actor)
    scheduling-url: http://localhost:8084     # FACEATTEND_AUTH_SCHEDULING_URL (alcance y ventana de llegada)
    configuration-url: http://localhost:8087  # FACEATTEND_AUTH_CONFIGURATION_URL (tardy_tolerance_minutes)
  attendance:
    zone: America/Bogota                      # FACEATTEND_ATTENDANCE_ZONE (hora local de los bloques)
```

---

## 9. Puertos del Servidor

| Puerto | Servicio |
|--------|----------|
| 8085 | REST API |
| 9092 | Kafka (externo) |
| 5432 | PostgreSQL (externo) |
| 9000 | MinIO (solo red interna `faceattend-data`; sin puerto publicado). Cifrado SSE-S3 con `MINIO_KMS_SECRET_KEY` |

---

## 10. Stack Actual

Attendance esta implementado en **Java 21 + Spring Boot** con arquitectura hexagonal. El servicio maneja registro de asistencia multi-fuente (FACIAL, MANUAL, FINGERPRINT, IMPORT), justificaciones y documentos de soporte.

### Justificacion

- **Spring Data JPA**: Persistencia relacional con constraints de unicidad por sesion/actor
- **Spring Security**: Autorizacion basada en roles para endpoints de asistencia
- **Kafka**: Eventos de dominio para notificaciones y auditoria
- **Testcontainers**: Tests de integracion con PostgreSQL real
