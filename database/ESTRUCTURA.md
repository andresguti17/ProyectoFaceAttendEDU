# Guía de Estructura — FaceAttend-Edu

## 1. Arquitectura general

FaceAttend-Edu usa **Domain-Driven Design (DDD)**: cada dominio de negocio tiene su propia base de datos lógica (schema PostgreSQL) y su propio ciclo de migración Liquibase.

```
database/
├── docker-compose.yml              ← Orquestador principal (PostgreSQL + 8 Liquibase)
├── .env                            ← Variables de entorno
├── scripts/init-multidb.sql        ← Script alternativo multi-DB (desarrollo usa 1 BD + 8 schemas)
│
├── 01-ms-identity-db/              → Contexto: Identity (4 tablas)
├── 02-ms-authorization-db/         → Contexto: Authorization (4 tablas)
├── 03-ms-academic-db/              → Contexto: Academic (8 tablas)
├── 04-ms-scheduling-db/            → Contexto: Scheduling (3 tablas)
├── 05-ms-attendance-db/            → Contexto: Attendance (5 tablas)
├── 06-ms-biometric-db/             → Contexto: Biometric (solo schema, colecciones NoSQL en MongoDB)
├── 07-ms-configuration-db/         → Contexto: Configuration (3 tablas, incluye biometric_update_case)
├── 08-ms-notification-db/          → Contexto: Notification (2 tablas)
│
├── CONVENCIONES.md                 ← Guía de naming y reglas
├── ESTRUCTURA.md                   ← Este archivo
└── MODELO.md                       ← Guía del modelo de datos
```

---

## 2. Mapping de carpetas → Bounded Contexts

| # | Carpeta | Contexto | Esquemas | Tablas |
|---|---|---|---|---|
| 01 | `01-ms-identity-db` | Identity | `identity` | `person`, `app_user`, `user_session`, `password_policy` |
| 02 | `02-ms-authorization-db` | Authorization | `authorization` | `role`, `permission`, `role_permission`, `user_role` |
| 03 | `03-ms-academic-db` | Academic | `academic` | `school`, `program`, `academic_period`, `cohort`, `course`, `academic_actor_type`, `academic_actor`, `enrollment` |
| 04 | `04-ms-scheduling-db` | Scheduling | `scheduling` | `environment`, `schedule_block`, `class_session` |
| 05 | `05-ms-attendance-db` | Attendance | `attendance` | `attendance_record`, `justification_type`, `justification`, `supporting_document`, `attendance_report` |
| 06 | `06-ms-biometric-db` | Biometric | `biometric` | Solo schema (colecciones NoSQL documentadas aparte) |
| 07 | `07-ms-configuration-db` | Configuration | `configuration` | `academic_configuration`, `security_configuration`, `biometric_update_case` |
| 08 | `08-ms-notification-db` | Notification | `notification` | `alert_type`, `alert` |
| — | `07-ms-configuration-db` (hospedado) | Quality | `quality` | `quality_project`, `quality_evaluation`, `quality_evaluation_item`, `process_assessment`, `process_assessment_rating`, `istqb_assessment`, `istqb_assessment_item` — sin changelog propio: no existe un servicio `quality-liquibase`, así que migra junto con Configuration |

---

## 3. Estructura interna de cada dominio

Cada carpeta de dominio sigue la misma estructura Liquibase:

```
NN-ms-{domain}-db/
├── docker-compose.yml           ← Ejecución individual del dominio
├── changelog/
│   └── changelog-master.yaml    ← Punto de entrada Liquibase
├── 01-ddl/                      ← Definición de datos (DDL)
│   ├── changelog.yaml           ← Agregador de archivos DDL
│   ├── 01-schemas/              ← CREATE SCHEMA
│   ├── 02-types/                ← CREATE TYPE (ENUMs)
│   ├── 03-tables/               ← CREATE TABLE + constraints
│   ├── 04-views/                ← CREATE VIEW
│   ├── 05-materialized-views/   ← CREATE MATERIALIZED VIEW
│   ├── 06-functions/            ← CREATE FUNCTION
│   ├── 07-procedures/           ← CREATE PROCEDURE
│   └── 08-triggers/             ← CREATE TRIGGER (archivos sueltos)
├── 02-dml/                      ← Manipulación de datos (DML)
│   ├── changelog.yaml
│   └── 001-seed-{tabla}.yaml    ← INSERT iniciales (seeds)
├── 03-dcl/                      ← Control de datos (DCL)
│   └── changelog.yaml           ← Roles, GRANTs, policies
├── 04-tcl/                      ← Control de transacciones (TCL)
│   ├── changelog.yaml
│   └── 001-triggers-*.yaml      ← Funciones PL/pgSQL + triggers
└── 05-rollbacks/                ← Scripts de reversión
    └── changelog.yaml           ← Siempre vacío: `databaseChangeLog: []`
```

---

## 4. Fases de ejecución Liquibase

Cada dominio ejecuta sus cambios en este orden:

```
01-ddl  →  02-dml  →  03-dcl  →  04-tcl
(esquemas,   (seeds,   (roles,   (triggers,
 tipos,       datos     grants)   funciones
 tablas)      iniciales)          PL/pgSQL)
```

### DDL (Data Definition Language)
- `01-schemas/` — Crea el esquema PostgreSQL del dominio
- `02-types/` — Crea ENUMs y tipos personalizados
- `03-tables/` — Crea tablas con constraints e índices
- `04-views/` — Crea vistas

### DML (Data Manipulation Language)
- Seeds: datos iniciales para tablas catálogo (roles, tipos de actor, ciudades, etc.)
- Se ejecutan con `context: seed` para poder excluirlos si es necesario

### TCL (Transaction Control Language)
- Funciones PL/pgSQL (`fn_audit_timestamps`, `fn_validate_*`)
- Triggers que usan esas funciones
- Se crean aquí porque necesitan `splitStatements: false`

---

## 5. Cómo ejecutar

### Opción 1: Todo junto (recomendado para desarrollo)

```bash
cd "database"
docker compose up -d
```

Esto:
1. Levanta PostgreSQL 17 y espera a que esté sano (faceattend_db + 8 schemas)
2. Ejecuta los 8 servicios Liquibase en paralelo (uno por dominio)
3. Cada servicio migra su esquema respectivo

### Opción 2: Dominio individual

```bash
cd "database/03-ms-academic-db"
docker compose up
```

### Opción 3: Reconstruir desde cero

```bash
cd "database"
docker compose down -v    # Elimina volúmenes (datos)
docker compose up -d
```

### Verificar estado

```bash
# Ver logs de un dominio específico
docker logs faceattend-academic-liquibase

# Conectar a PostgreSQL
docker exec -it faceattend-postgres-18 psql -U postgres -d faceattend_db

# Ver esquemas creados
\dn

# Ver tablas de un esquema
\dt academic.*
```

---

## 6. Docker Compose individual

Cada carpeta de dominio tiene su propio `docker-compose.yml` para ejecución independiente contra una BD existente:

```yaml
services:
  liquibase:
    image: liquibase/liquibase:4.29.0
    container_name: faceattend-{domain}-liquibase
    command:
      - --url=jdbc:postgresql://host.docker.internal:5432/faceattend_db
      - --username=postgres
      - --password=postgres
      - --changeLogFile=/liquibase/changelog/changelog/changelog-master.yaml
      - update
    volumes:
      - .:/liquibase/changelog
    working_dir: /liquibase/changelog
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Usa `host.docker.internal` para conectarse a PostgreSQL que corre en el host.

---

## 7. Archivos importantes

| Archivo | Propósito |
|---|---|
| `docker-compose.yml` | Orquestador principal |
| `.env` | Variables de entorno (credenciales, imagen Liquibase) |
| `scripts/init-multidb.sql` | Script alternativo multi-DB (8 BDs). En desarrollo se usa 1 BD + 8 schemas |
| `CONVENCIONES.md` | Reglas de nomenclatura y diseño |
| `ESTRUCTURA.md` | Este archivo |
| `MODELO.md` | Documento conceptual del modelo de datos |
