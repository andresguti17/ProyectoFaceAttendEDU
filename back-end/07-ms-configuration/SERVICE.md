# Configuration Service — `07-ms-configuration`

## 1. Responsabilidad

Gestionar parametros configurables del sistema (academicos por sede y de seguridad globales) y el flujo de aprobacion de actualizaciones biometricas.

## 2. Tablas

| Tabla | Descripcion | PK |
|-------|-------------|-----|
| `academic_configuration` | Parametros por sede (tardy_tolerance, etc.) | `configuration_id` (INT) |
| `security_configuration` | Parametros globales de seguridad | `configuration_id` (INT) |
| `biometric_update_case` | Solicitud de actualizacion biometrica | `case_id` (UUID) |

**Cross-context:**
- `academic_configuration.school_id` → `Academic.school.school_id`
- `biometric_update_case.person_id` → `Identity.person.person_id`
- `biometric_update_case.requested_by` → `Identity.app_user.user_id`
- `biometric_update_case.reviewed_by` → `Identity.app_user.user_id`

## 3. Stack Tecnologico

### 3.1 Lenguaje y Framework

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Lenguaje | **TypeScript 5** | Type-safe, DX moderno |
| Framework | **Fastify 4** | HTTP framework ultrarapido, validacion con Zod |
| Arquitectura | **Hexagonal** | Misma estructura |

### 3.2 Dependencias Principales

```json
// package.json
"dependencies": {
  "fastify": "^4.26.0",   // HTTP framework
  "pg": "^8.11.0",        // PostgreSQL driver
  "zod": "^3.22.0",       // Validacion de schemas
  "kafkajs": "^2.2.4",    // Domain Events
  "pino": "^8.16.0"       // Structured logging
}
```

### 3.3 Librerias Recomendadas Adicionales

| Libreria | Uso | Por que |
|----------|-----|---------|
| **Zod** | Validacion | Validacion declarativa de configuraciones |
| **Pino** | Logging | Logs JSON estructurados |
| **Kafkajs** | Domain Events | Publicacion de cambios de config |
| **Jest + ts-jest** | Tests | Unit tests con TypeScript |
| **Testcontainers** | Tests de integracion | PostgreSQL real en tests |

### 3.4 Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **npm** | Gestion de dependencias |
| **TypeScript (tsc)** | Compilacion |
| **Docker** | Containerizacion |
| **VS Code** | IDE principal |
| **DBeaver** | Cliente PostgreSQL |
| **Postman / Bruno** | Testing REST |

---

## 4. Endpoints

### 4.1 Configuracion Academica

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/configurations/academic` | Crear configuracion academica |
| GET | `/api/v1/configurations/academic/{id}` | Obtener configuracion |
| PUT | `/api/v1/configurations/academic/{id}` | Actualizar configuracion |
| GET | `/api/v1/schools/{schoolId}/configurations` | Configuraciones de una sede |
| GET | `/api/v1/configurations/academic?name={name}` | Buscar por nombre |

### 4.2 Configuracion de Seguridad

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/configurations/security` | Crear configuracion de seguridad |
| GET | `/api/v1/configurations/security/{id}` | Obtener configuracion |
| PUT | `/api/v1/configurations/security/{id}` | Actualizar configuracion |
| GET | `/api/v1/configurations/security` | Listar todas |
| GET | `/api/v1/configurations/security?name={name}` | Buscar por nombre |

### 4.3 Casos de Actualizacion Biometrica

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/biometric-update-cases` | Crear solicitud |
| GET | `/api/v1/biometric-update-cases/{id}` | Obtener solicitud |
| PATCH | `/api/v1/biometric-update-cases/{id}/review` | Revisar solicitud |
| GET | `/api/v1/biometric-update-cases?status={status}` | Filtrar por estado |
| GET | `/api/v1/persons/{personId}/biometric-cases` | Casos de una persona |

---

## 5. Domain Events

| Evento | Trigger | Consumidores tipicos |
|--------|---------|---------------------|
| `AcademicConfigurationUpdated` | Config academica modificada | Scheduling |
| `SecurityConfigurationUpdated` | Config seguridad modificada | Identity |
| `BiometricUpdateRequested` | Solicitud de actualizacion biom. | Biometric, Notification |
| `BiometricUpdateApproved` | Solicitud aprobada | Biometric (aplicar cambio) |
| `BiometricUpdateRejected` | Solicitud rechazada | Notification (informar) |

---

## 6. Flujo de Actualizacion Biometrica

```
academic_actor/person solicita actualizacion
       │
       ▼
biometric_update_case (Pending)
       │
       │ reviewer revisa
       ▼
biometric_update_case (In_Review)
       │
       ├── APPROVED ──> Biometric aplica nuevo embedding
       │                  │
       │                  ▼
       │              facial/fingerprint_embedding (nueva version)
       │
       └── REJECTED ──> Notification informa al solicitante
```

### Estados de actualizacion

| Estado | Descripcion |
|--------|-------------|
| Pending | Solicitud creada, esperando revision |
| In_Review | Un revisor esta evaluando la solicitud |
| Approved | Solicitud aprobada, Biometric debe aplicar |
| Rejected | Solicitud rechazada con notas |

### Campos de `biometric_update_case`

| Campo | Descripcion |
|-------|-------------|
| `biometric_type` | FACIAL / FINGERPRINT |
| `finger_number` | 1..10 solo si FINGERPRINT, nulo si FACIAL |
| `current_embedding_ref` | Referencia logica al documento activo en MongoDB |
| `reason` | Motivo de la actualizacion |
| `requested_by` | Quien solicito |
| `reviewed_by` | Quien reviso |
| `resolution_notes` | Notas de la decision |

---

## 7. Configuracion

### .env (ejemplo)

```bash
PORT=8087
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/faceattend_db
DB_SCHEMA=configuration
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=configuration-service
```

---

## 8. Puertos del Servidor

| Puerto | Servicio |
|--------|----------|
| 8087 | REST API |
| 9092 | Kafka (externo) |
| 5432 | PostgreSQL (externo) |

---

## 9. Stack Actual

Configuration esta implementado en **TypeScript + Fastify** con arquitectura hexagonal. El servicio gestiona parametros academicos por sede, configuracion de seguridad global y el flujo de aprobacion de actualizaciones biometricas.

### Justificacion

- **Fastify**: HTTP framework de alto rendimiento para Node.js
- **pg**: Driver nativo de PostgreSQL, CRUD directo sin ORM
- **Zod**: Validacion declarativa de configuraciones
- **Pino**: Logs JSON estructurados
- **Kafka (Kafkajs)**: Eventos de dominio para notificaciones

