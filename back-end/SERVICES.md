# FaceAttend-Edu — Guia General de Microservicios

## 1. Vision General

FaceAttend-Edu es una plataforma de gestion de asistencia mediante reconocimiento biometrico para instituciones educativas. La arquitectura se basa en **8 bounded contexts + API Gateway** en **polyglot modular monolith** (ADR-002, ADR-005, ADR-007), donde cada dominio tiene su propia base de datos logica (schema PostgreSQL) y ciclo Liquibase. **Audit excluido por solicitud** (antes 07-ms-audit, ahora eliminado).

```
ms/
├── 01-ms-identity/          → Identity (personas, usuarios, sesiones)          Java Spring Boot 8081
├── 02-ms-authorization/     → Authorization (RBAC)                             Java Spring Boot 8082
├── 03-ms-academic/          → Academic (sedes, programas, cohortes, cursos)    TS Fastify+Drizzle 8083
├── 04-ms-scheduling/        → Scheduling (horarios y sesiones de clase)         Java Spring Boot 8084
├── 05-ms-attendance/        → Attendance (asistencia, justificaciones)         Java Spring Boot 8085
├── 06-ms-biometric/         → Biometric (embeddings facial/dactilar)           Python FastAPI 8086 + MongoDB
├── 07-ms-configuration/     → Configuration (parámetros + biometric_update_case) TS Fastify 8087
├── 08-ms-notification/      → Notification (alertas)                           Go Gin 8088
├── 09-ms-quality/           → Quality (instrumento ISO 25010, evaluaciones)    TS Fastify 8089
├── 99-api-gateway/          → API Gateway (Kong OSS DB-less + Redis)           Kong 8000/8001
└── ../database/             → Migraciones Liquibase (8 schemas, 1 BD faceattend_db)
```

Fuente canónica de modelo: `../../fae-docs/06-data/domains/*.md` ; Stack: `ADR-005 + ADR-007` ; Hexagonal: `05-architecture/hexagonal-architecture.md` ; Guías: `_stacks/*.md`. Ver `DATABASE.md` para mapa detallado.

---

## 2. Arquitectura

### 2.1 Patron: Arquitectura Hexagonal (Puertos y Adaptadores)

Todos los servicios 01-08 siguen hexagonal (`_stacks/java-spring.md`, `node-typescript.md`, `python-fastapi.md`, `go.md`). Gateway 99 es infra (no hexagonal).

- **Java (01,02,04,05):** `src/main/java/.../domain` (POJO sin Spring) → `application/usecase` → `infrastructure/web,persistence,messaging` — ver `_stacks/java-spring.md`
- **TypeScript (03,07):** `src/domain` → `application/use-cases` → `infrastructure/http,persistence,messaging` → `main.ts` — ver `_stacks/node-typescript.md`
- **Python (06):** `domain/` → `application/use_cases` → `infrastructure/web,persistence,messaging` → `main.py + alembic/` — ver `_stacks/python-fastapi.md`
- **Go (08):** `internal/domain` → `internal/application/usecase` → `internal/infrastructure/http,postgres,kafka` → `cmd/server/main.go` — ver `_stacks/go.md`

### 2.2 Stack Tecnologico Base (ADR-005 + ADR-007)

| Servicio | Lenguaje | Framework | Puerto | DB | Razon ADR-005/007 |
|----------|----------|-----------|--------|----|-------------------|
| Identity 01 | Java 21 | Spring Boot 4.1.1 | 8081 | PostgreSQL identity | Hibernate/JPA + Spring Security JWT/Session |
| Authorization 02 | Java 21 | Spring Boot 4.1.1 | 8082 | PostgreSQL authorization | Spring Security RBAC, permisos en JWT |
| Academic 03 | TypeScript | Fastify + Drizzle | 8083 | PostgreSQL academic | Drizzle JOINs 7 tablas eficiente |
| Scheduling 04 | Java 21 | Spring Boot 4.1.1 | 8084 | PostgreSQL scheduling | @UniqueConstraint anti-double-booking + ACID |
| Attendance 05 | Java 21 | Spring Boot 4.1.1 | 8085 | PostgreSQL attendance | @Transactional ACID crítico |
| Biometric 06 | Python 3.12 | FastAPI | 8086 | MongoDB biometric | OpenCV/pymongo vector — único viable |
| Configuration 07 | TypeScript | Fastify | 8087 | PostgreSQL configuration | CRUD trivial 3 tablas |
| Notification 08 | Go 1.22 | Gin | 8088 | PostgreSQL notification | Binario 5-10 MB para 2 tablas |
| Gateway 99 | — | Kong OSS 3.6 DB-less + Redis 7 | 8000/8001 | Redis cache | Plugins JWT/rate-limit/CORS, kong.yml declarativo (ADR-007) |

Ver `ADR-005-technology-stack.md` para scoring y `ADR-007-api-gateway.md` para gateway.

### 2.3 Politica de Lenguajes (ADR-005)

| Lenguaje | Servicios | Total | Imagen |
|----------|-----------|-------|--------|
| **Java 21** | Identity, Authorization, Scheduling, Attendance | 4/8 | ~200 MB spring-boot |
| **TypeScript** | Academic (Drizzle), Configuration | 2/8 | ~50 MB node-slim |
| **Python 3.12** | Biometric | 1/8 | ~150 MB python-slim |
| **Go 1.22** | Notification | 1/8 | ~8 MB distroless |
| **Kong/Redis** | Gateway 99 (infra) | — | kong:3.6 + redis:7-alpine (compartido, red `faceattend-app`) |

Polyglot modular monolith: JVM + Node + Python + Go + Kong. 4 runtimes + gateway.

### 2.4 Comunicacion entre Servicios

| Tipo | Mecanismo | Uso |
|------|-----------|-----|
| Sincrona | REST via Kong 8000 | CRUD |
| Asincrona | Kafka | Domain Events |
| Cross-context | UUID sin FK | Referencias entre schemas |

### 2.5 Base de Datos

- **Motor:** PostgreSQL 17 (1 instancia, 8 schemas) + MongoDB 7 (biometric) + Redis 7 (gateway)
- **Patron:** Database-per-Bounded-Context
- **Migraciones:** Liquibase 01-ddl → 02-dml → 03-dcl → 04-tcl (ver `../database/ESTRUCTURA.md`)
- **Regla:** Nunca FK reales entre contextos distintos

---

## 3. Servicios

### 3.1 Identity (`01-ms-identity`) — Java 8081
**Responsabilidad:** Identidad de personas, credenciales de acceso, sesiones y password_policy.
**Tablas:** `person`, `app_user`, `user_session`, `password_policy` — Ver `06-data/domains/01-identity.md` y `../database/01-ms-identity-db`
**Detalle:** Ver `01-ms-identity/SERVICE.md` + `STACK.md` + `DATA_MODEL.md`

### 3.2 Authorization (`02-ms-authorization`) — Java 8082
**Responsabilidad:** RBAC.
**Tablas:** `role`, `permission`, `role_permission`, `user_role` — Ver `06-data/domains/02-authorization.md`
**Detalle:** Ver `02-ms-authorization/SERVICE.md`

### 3.3 Academic (`03-ms-academic`) — TS Fastify+Drizzle 8083
**Responsabilidad:** `school`, `program`, `academic_period`, `cohort`, `course`, `academic_actor_type`, `academic_actor`, `enrollment` — Ver `06-data/domains/03-academic.md`

### 3.4 Scheduling (`04-ms-scheduling`) — Java 8084
**Responsabilidad:** `environment`, `schedule_block`, `class_session` — Ver `06-data/domains/04-scheduling.md` — unique `(environment,day,starts_at)` y `(instructor,day,starts_at)` previenen double-booking.

### 3.5 Attendance (`05-ms-attendance`) — Java 8085
**Responsabilidad:** `attendance_record`, `justification_type`, `justification`, `supporting_document` (+ `attendance_report`) — Ver `06-data/domains/05-attendance.md`

### 3.6 Biometric (`06-ms-biometric`) — Python FastAPI 8086
**Responsabilidad:** Híbrido SQL vacío + MongoDB `facial_embeddings`, `fingerprint_embeddings`; caso en `configuration.biometric_update_case` — Ver `06-data/domains/06-biometric.md`. Incluye el cómputo de embeddings a partir de imagen/muestra (liveness, rostro vía dlib, huella vía matching de keypoints OpenCV), fusionado desde el antiguo `10-ms-face-auth`.
**Stack:** `_stacks/python-fastapi.md`

### 3.7 Configuration (`07-ms-configuration`) — TS Fastify 8087
**Responsabilidad:** `academic_configuration`, `security_configuration`, `biometric_update_case` — Ver `06-data/domains/08-configuration.md` (dominio 08 mapea a 07 tras reorden)

### 3.8 Notification (`08-ms-notification`) — Go Gin 8088
**Responsabilidad:** `alert_type`, `alert` sobre `academic_actor` — Ver `06-data/domains/07-notification.md` (dominio 07 mapea a 08)

### 3.9 Quality (`09-ms-quality`) — TS Fastify 8089
**Responsabilidad:** Instrumento ISO/IEC 25010 (24 ítems) + CRUD de evaluaciones y promedios por servicio — Ver `09-ms-quality/SERVICE.md` + `ISO25010_QUALITY_REPORT.md`

### 3.10 Gateway (`99-api-gateway`) — Kong OSS 8000
**Responsabilidad:** Routing, JWT RS256, rate-limit, CORS, TLS. Kong DB-less `kong/kong.yml` + Redis. Ver `99-api-gateway/SERVICE.md` y `ADR-007-api-gateway.md`.

---

## 4. Diagrama de Dependencias

```
                 Kong 99 (8000)  [Redis]
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   IDENTITY     AUTHORIZATION   ACADEMIC ──┐
   8081 Java     8082 Java     8083 TS    │
        └────────────┼────────────┘        │
                     ▼                    ▼
              SCHEDULING  ←─────── ACADEMIC
               8084 Java                  │
                     │                    ▼
                     ▼              CONFIGURATION
               ATTENDANCE           8087 TS
               8085 Java                  │
                     │                    ▼
              BIOMETRIC  ←──────── NOTIFICATION
              8086 Python         8088 Go
```

Audit eliminado. Gateway es edge; Attendance es critical path ACID; Biometric es MongoDB vector.

---

## 5. Convenciones Comunes

### 5.1 Auditoria
Todas las tablas incluyen: `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `deleted_by`, `row_version` — Soft delete via `deleted_at`.

### 5.2 Identificadores
| Tipo | Uso | Ejemplo |
|------|-----|---------|
| UUID | Entidades entre contextos | `person_id`, `user_id` |
| INT autoincrement | Catalogos locales | `school_id`, `role_id` |
| BIGINT autoincrement | Alto volumen | `cohort_id` |
| SMALLINT autoincrement | Catalogos pequeños | `actor_type_id`, `alert_type_id` |

### 5.3 ENUMs
`CREATE TYPE ... AS ENUM`, no VARCHAR con validación textual.

### 5.4 Cross-Context References
Nunca FK reales entre contextos distintos. Solo comentarios `remarks: Cross-context reference ... NO FK`.

---

## 6. Ejecucion

### Arranque completo (desarrollo)

```bash
docker compose up -d --build        # desde FULL/: todo el stack
```

La raíz `docker-compose.yml` incluye `database/` (PostgreSQL + 8 Liquibase) y
`back-end/` (9 microservicios + Kong); `frontend-web` tambien vive en la raíz.
Tres redes, una por capa: `faceattend-edge` (frontend ↔ Kong),
`faceattend-app` (Kong ↔ microservicios ↔ Redis) y `faceattend-data`
(microservicios ↔ PostgreSQL / MongoDB / Kafka + Liquibase).

### Por pieza

```bash
cd database && docker compose up -d                 # PostgreSQL 17 + 8 Liquibase
cd back-end/99-api-gateway && docker compose up -d  # solo Kong (requiere el stack FULL/ ya creado)
```

### Servicio individual

```bash
# Java 01,02,04,05
./mvnw spring-boot:run

# TS 03,07
npm run dev

# Python 06
uvicorn main:app --reload --port 8086

# Go 08
go run cmd/server/main.go

# Kong 99
docker compose up -d && curl http://localhost:8001/
```

### Verificar estado

```bash
docker exec -it faceattend-postgres psql -U postgres -d faceattend_db
\dn
\dt academic.*
curl http://localhost:8000/api/v1/persons  # via Kong
```

---

## 7. Documentacion por Servicio

| Servicio | Documento | Stack | Estado |
|----------|-----------|-------|--------|
| Identity 01 | `01-ms-identity/SERVICE.md` + `STACK.md` + `DATA_MODEL.md` | Java Spring Boot | Implementado |
| Authorization 02 | `02-ms-authorization/...` | Java Spring Boot | Pendiente |
| Academic 03 | `03-ms-academic/...` | TS Fastify+Drizzle | Pendiente |
| Scheduling 04 | `04-ms-scheduling/...` | Java Spring Boot | Pendiente |
| Attendance 05 | `05-ms-attendance/...` | Java Spring Boot | Pendiente |
| Biometric 06 | `06-ms-biometric/...` | Python FastAPI | Pendiente |
| Configuration 07 | `07-ms-configuration/...` | TS Fastify | Pendiente |
| Notification 08 | `08-ms-notification/...` | Go Gin | Pendiente |
| Gateway 99 | `99-api-gateway/SERVICE.md` + `kong/kong.yml` | Kong OSS | Infra |

Audit excluido por solicitud. Ver `DATABASE.md` y `../../fae-docs/06-data/domains` + `ADR-005/007` + `_stacks/`.
