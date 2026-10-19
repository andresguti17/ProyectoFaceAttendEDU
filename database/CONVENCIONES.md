# Guía de Convenciones — FaceAttend-Edu

## 1. Convenciones de nomenclatura

### Archivos Liquibase

| Tipo de archivo | Prefijo | Ejemplo |
|---|---|---|
| Schema | `001-create-{schema}-schema.yaml` | `001-create-identity-schema.yaml` |
| Tipo/ENUM | `001-create-{tipo}-type.yaml` | `001-create-enrollment-status-type.yaml` |
| Tabla | `001-create-{tabla}-table.yaml` | `001-create-person-table.yaml` |
| Seed DML | `001-seed-{tabla}-table.yaml` | `001-seed-city-table.yaml` |
| Trigger | `001-triggers-{funcion}.yaml` | `001-triggers-audit-timestamps.yaml` |
| Vistas | `001-create-{domain}-views.yaml` | `001-create-identity-views.yaml` |

Los prefijos numéricos (`001-`, `002-`, ...) determinan el **orden de ejecución** dentro de cada fase.

### Nombres de tablas

- **snake_case** en todo: `academic_actor`, `schedule_block`, `biometric_update_case`
- **Singular**: `person`, `course`, `enrollment` (nunca `persons`, `courses`)
- **Nombres descriptivos**: `attendance_record` (no `attendance` genérico)

### Nombres de columnas

- **snake_case**: `person_id`, `actor_type_id`, `created_at`
- **Sufijo `_id`** para claves primarias y foráneas: `school_id`, `user_id`
- **Sufijo `_at`** para timestamps: `created_at`, `started_on`, `ended_on`
- **Sufijo `_by`** para usuarios: `created_by`, `deleted_by`
- **Sufijo `_status`** para estados: `session_status`, `enrollment_status`

### Nombres de constraints

| Tipo | Formato | Ejemplo |
|---|---|---|
| Primary Key | `pk_{tabla}` | `pk_person` |
| Unique | `uq_{tabla}_{columnas}` | `uq_person_document` |
| Foreign Key | `fk_{tabla}_{referencia}` | `fk_actor_school` |
| Index | `idx_{tabla}_{columna}` | `idx_person_deleted` |

### Nombres de esquemas

Un **esquema PostgreSQL por dominio** (bounded context). `biometric` es un schema vacío (colecciones en MongoDB):

| Dominio | Esquema | Notas |
|---|---|
| Identity | `identity` | 4 tablas |
| Authorization | `authorization` | 4 tablas |
| Academic | `academic` | 8 tablas |
| Scheduling | `scheduling` | 3 tablas |
| Attendance | `attendance` | 5 tablas |
| Biometric | `biometric` | Solo schema, sin tablas (NoSQL en MongoDB) |
| Configuration | `configuration` | 3 tablas (incluye `biometric_update_case`) |
| Notification | `notification` | 2 tablas |

---

## 2. Convenciones de auditoría

Todas las tablas incluyen este bloque de columnas **sin excepción**:

```yaml
- column: { name: created_at,    type: TIMESTAMP, nullable: false }
- column: { name: updated_at,    type: TIMESTAMP, nullable: true  }
- column: { name: deleted_at,    type: TIMESTAMP, nullable: true  }
- column: { name: created_by,    type: UUID,      nullable: true  }
- column: { name: updated_by,    type: UUID,      nullable: true  }
- column: { name: deleted_by,    type: UUID,      nullable: true  }
- column: { name: row_version,   type: BIGINT,    nullable: false, defaultValueNumeric: 1 }
```

**Reglas:**
- `deleted_at` → **borrado lógico** (soft delete). Ninguna tabla elimina registros físicamente.
- `row_version` → **bloqueo optimista**. Se incrementa en cada UPDATE vía trigger.
- `created_by` / `updated_by` / `deleted_by` → Siempre `UUID` (apuntan a `Identity.app_user.user_id`).
- Los triggers `fn_audit_timestamps()` en cada esquema gestionan `created_at`, `updated_at` y `row_version` automáticamente.

---

## 3. Convenciones de Foreign Keys

### Dentro de un mismo contexto (intra-context)

Las FK son **reales** a nivel de base de datos:

```yaml
- addForeignKeyConstraint:
    baseTableName: enrollment
    baseTableSchemaName: academic
    baseColumnNames: cohort_id
    referencedTableName: cohort
    referencedTableSchemaName: academic
    referencedColumnNames: cohort_id
    onDelete: CASCADE
```

### Entre contextos distintos (cross-context)

**NUNCA** se crean FK reales. La referencia se documenta como comentario:

```yaml
- column:
    name: person_id
    type: UUID
    remarks: "Cross-context reference to Identity.person (NO FK)"
```

**¿Por qué?** Facilita la migración futura a microservicios con bases de datos independientes.

---

## 4. Convenciones de identificadores

| Tipo | Uso | Ejemplo |
|---|---|---|
| `UUID` | Entidades referenciadas desde otros contextos | `person_id`, `user_id`, `case_id` |
| `INT` autoincrement | Entidades locales, catálogos | `role_id`, `school_id` |
| `BIGINT` autoincrement | Entidades de alto volumen | `cohort_id`, `enrollment_id`, `alert_id` |
| `SMALLINT` autoincrement | Catálogos pequeños | `actor_type_id`, `alert_type_id` |

**Regla:** Si una columna aparece en un comentario cross-context (`// campo -> Contexto.tabla`), su tipo debe ser `UUID`.

---

## 5. Convenciones de ENUMs

Los enums se modelan como **tipos PostgreSQL personalizados** (`CREATE TYPE ... AS ENUM`), no como `VARCHAR` con validación textual (el DBML los documenta como `varchar` con `note: ENUM` pero la implementación usa tipos nativos).

```yaml
- createType:
    schemaName: attendance
    typeName: attendance_status
    asEnum: "Present;Absent;Late;Justified"
```

Las columnas que usan ENUMs referencian el tipo completo:

```yaml
- column:
    name: attendance_status
    type: attendance.attendance_status
    defaultValue: "Present"
```

**ENUMs del modelo (DBML v4):** `user_session_status` (Active/Closed), `authentication_type` (Local/Windows/External), `enrollment_status` (Active/Withdrawn/Completed), `class_session_status` (Open/Closed/Cancelled), `attendance_status` (Present/Absent/Late/Justified), `capture_method` (FACIAL/MANUAL/IOT/IMPORT), `review_status` (Pending/Approved/Rejected), `biometric_type` (FACIAL/FINGERPRINT), `update_status` (Pending/In_Review/Approved/Rejected).

---

## 6. Convenciones de Liquibase

### Estructura de carpetas por dominio

```
NN-ms-{domain}-db/
├── changelog/
│   └── changelog-master.yaml    ← Punto de entrada
├── 01-ddl/                      ← Esquemas, tipos, tablas, vistas
│   ├── changelog.yaml
│   ├── 01-schemas/
│   ├── 02-types/
│   ├── 03-tables/
│   ├── 04-views/
│   ├── 05-materialized-views/
│   ├── 06-functions/
│   ├── 07-procedures/
│   └── 08-triggers/
├── 02-dml/                      ← Seeds, inserts, updates
│   └── changelog.yaml
├── 03-dcl/                      ← Roles, grants, policies
│   └── changelog.yaml
├── 04-tcl/                      ← Triggers (funciones PL/pgSQL)
│   └── changelog.yaml
├── 05-rollbacks/                ← Scripts de reversión
│   └── changelog.yaml
└── docker-compose.yml           ← Ejecución individual
```

### Orden de ejecución

El `changelog-master.yaml` ejecuta las fases en orden:

```yaml
databaseChangeLog:
  - include: 01-ddl/changelog.yaml    ← 1° Tablas
  - include: 02-dml/changelog.yaml    ← 2° Datos
  - include: 04-tcl/changelog.yaml    ← 3° Triggers
```

### Reglas de changelogs

- Los archivos usan `relativeToChangelogFile: true` para rutas relativas.
- El `changelog-master.yaml` usa prefijo `../` porque está en subdirectorio `changelog/`.
- Los `05-rollbacks/changelog.yaml` siempre contienen `databaseChangeLog: []`.

---

## 7. Docker / Ejecución

### Arranque completo

```bash
cd database
docker compose up -d
```

Esto levanta PostgreSQL 17 (faceattend_db + 8 schemas) + los 8 servicios Liquibase que migran todos los dominios.

### Dominio individual

```bash
cd database/03-ms-academic-db
docker compose up
```

### Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `POSTGRES_USER` | `postgres` | Usuario de PostgreSQL |
| `POSTGRES_PASSWORD` | `postgres` | Contraseña de PostgreSQL |
| `POSTGRES_DB` | `faceattend_db` | Base de datos principal |
| `POSTGRES_PORT` | `5432` | Puerto de PostgreSQL |

> **PostgreSQL 17** — El proyecto usa `postgres:17-alpine`. Todos los ENUMs, funciones PL/pgSQL y constraints son compatibles con PG17.
| `FACEATTEND_LIQUIBASE_IMAGE` | `liquibase/liquibase:4.29.0` | Imagen de Liquibase |
