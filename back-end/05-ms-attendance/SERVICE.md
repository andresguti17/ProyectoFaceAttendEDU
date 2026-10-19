# Attendance Service — `05-ms-attendance`

## 1. Responsabilidad

Registro de asistencia con multiples fuentes (reconocimiento facial, manual, IoT, importacion), justificaciones de inasistencia/tardanza y gestion de documentos de soporte.

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
| Framework | **Spring Boot 4.1.1** | Ecosistema unificado |
| Arquitectura | **Hexagonal** | Misma estructura |
| API alternativa | **Spring WebFlux** (opcional) | Endpoint reactivo para registro IoT en tiempo real |

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

<!-- Reactivo (opcional, para IoT) -->
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
| **Spring WebFlux** | Endpoint reactivo | Para dispositivos IoT que envian asistencia |
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
| POST | `/api/v1/attendance` | Registrar asistencia (FACIAL/MANUAL/IOT/IMPORT) |
| GET | `/api/v1/attendance/{id}` | Obtener registro |
| PUT | `/api/v1/attendance/{id}` | Actualizar registro |
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
| POST | `/api/v1/justifications/{justId}/documents` | Subir documento |
| GET | `/api/v1/justifications/{justId}/documents` | Listar documentos |
| GET | `/api/v1/documents/{id}/download` | Descargar documento |
| DELETE | `/api/v1/documents/{id}` | Eliminar documento |

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
| **IOT** | Dispositivo IoT (lector huella, QR) | Dispositivo envia → Attendance registra |
| **IMPORT** | Importacion masiva CSV/Excel | Archivo procesado → Attendance registra |

### Estados de asistencia

| Estado | Descripcion |
|--------|-------------|
| Present | Asistencia confirmada |
| Absent | Inasistencia sin justificar |
| Late | Tardanza (llegada despues del inicio) |
| Justified | Inasistencia/tardanza justificada |

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
      max-file-size: 10MB
      max-request-size: 10MB
  kafka:
    bootstrap-servers: localhost:9092
    group-id: attendance-service

# Almacenamiento de documentos
storage:
  type: local  # local | s3 | minio
  local:
    path: ./uploads/justifications
  minio:
    endpoint: http://localhost:9000
    bucket: faceattend-documents
```

---

## 9. Puertos del Servidor

| Puerto | Servicio |
|--------|----------|
| 8085 | REST API |
| 9092 | Kafka (externo) |
| 5432 | PostgreSQL (externo) |
| 9000 | MinIO (externo, opcional) |

---

## 10. Stack Actual

Attendance esta implementado en **Java 21 + Spring Boot** con arquitectura hexagonal. El servicio maneja registro de asistencia multi-fuente (FACIAL, MANUAL, IOT, IMPORT), justificaciones y documentos de soporte.

### Justificacion

- **Spring Data JPA**: Persistencia relacional con constraints de unicidad por sesion/actor
- **Spring Security**: Autorizacion basada en roles para endpoints de asistencia
- **Kafka**: Eventos de dominio para notificaciones y auditoria
- **Testcontainers**: Tests de integracion con PostgreSQL real
