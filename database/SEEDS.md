# Predefined Records — FaceAttend-Edu

## 1. Overview

These records are created automatically when running Liquibase migrations (`docker compose up`). They are **seed** data for catalog tables required at startup.

All seeds run with `context: seed`, allowing structure-only execution.

Note: `identity.city` has no seeds — cities come from external API `countriesnow.space` (`front-end/Mobile/src/api/apiCountry.js:1`).

---

## 2. Authorization — `authorization.role`

RBAC roles. Assigned via `user_role`.

| ID | Role | Description |
|----|------|-------------|
| 1 | `Administrador` | Rol Mobile: acceso total |
| 2 | `Instructor` | Rol Mobile: docencia y asistencia |
| 3 | `Aprendiz` | Rol Mobile: consulta propia |
| — | `Super Administrador` | Rol Web: administrador global sin sede (id asignado por migración) |

**File:** `02-ms-authorization-db/02-dml/001-seed-role-table.yaml` (legado de 4 roles) + `004-unify-mobile-roles.yaml` (unificación a 3 roles Mobile; renombra `SUPER_ADMIN`→`Administrador`, `INSTRUCTOR`→`Instructor`, `STUDENT`→`Aprendiz`, fusiona `SCHOOL_ADMIN` en `Administrador` y carga la matriz `role_permission`) + `007-split-super-admin-role.yaml` (rol explícito `Super Administrador`, con los 12 permisos, y reasignación del admin bootstrap desde `Administrador`)

> Bootstrap: `01-ms-identity-db/02-dml/001-bootstrap-admin-user.yaml` crea `person` + `app_user` (`admin.faceattend` / `Admin123!ChangeMe`, **cambiar en producción**), `002-bootstrap-demo-users.yaml` crea `instructor.faceattend` / `Instructor123!ChangeMe` y `aprendiz.faceattend` / `Aprendiz123!ChangeMe`, y `005/006-bootstrap-*-role-assignment.yaml` les asignan `Administrador`, `Instructor` y `Aprendiz` (`007` posteriormente pasa `admin.faceattend` a `Super Administrador`). Sin estos usuarios iniciales ningún endpoint protegido sería alcanzable.

---

## 3. Authorization — `authorization.permission`

Atomic permissions with bounded-context prefix (`context.resource:action`). Assigned to roles via `role_permission`.

| ID | Permission | Description |
|----|------------|-------------|
| 1 | `identity.person:read` | View persons |
| 2 | `identity.person:write` | Create/update persons |
| 3 | `academic.school:manage` | Manage schools |
| 4 | `academic.enrollment:manage` | Manage enrollments |
| 5 | `scheduling.session:manage` | Manage sessions and schedule |
| 6 | `attendance.record:read` | View attendance |
| 7 | `attendance.record:write` | Create/update attendance |
| 8 | `attendance.justification:approve` | Approve justifications |
| 9 | `biometric.case:request` | Request biometric update |
| 10 | `biometric.case:review` | Review biometric updates |
| 11 | `configuration:manage` | Manage configuration |
| 12 | `notification.alert:read` | View alerts |

**Files:** `02-ms-authorization-db/02-dml/002-seed-permission-table.yaml` (1–12) + `008-justification-request-permission.yaml` (13)

### Role × permission matrix (enforced by `004-unify-mobile-roles.yaml`, `007-split-super-admin-role.yaml` and `008-justification-request-permission.yaml`)

| Permission | Super Administrador | Administrador | Instructor | Aprendiz |
|---------|:-------------------:|:-------------:|:----------:|:--------:|
| `identity.person:read` | ✅ | ✅ | ✅ | ✅ |
| `identity.person:write` | ✅ | ✅ | ❌ | ❌ |
| `academic.school:manage` | ✅ | ✅ | ❌ | ❌ |
| `academic.enrollment:manage` | ✅ | ✅ | ❌ | ❌ |
| `scheduling.session:manage` | ✅ | ✅ | ✅ | ❌ |
| `attendance.record:read` | ✅ | ✅ | ✅ | ✅ |
| `attendance.record:write` | ✅ | ✅ | ✅ | ❌ |
| `attendance.justification:approve` | ✅ | ✅ | ✅ | ❌ |
| `biometric.case:request` | ✅ | ✅ | ✅ | ✅ |
| `biometric.case:review` | ✅ | ✅ | ✅ | ❌ |
| `configuration:manage` | ✅ | ✅ | ❌ | ❌ |
| `notification.alert:read` | ✅ | ✅ | ✅ | ✅ |

---

## 4. Academic — `academic.academic_actor_type`

| ID | Code | Name |
|----|------|------|
| 1 | `STUDENT` | Student |
| 2 | `INSTRUCTOR` | Instructor |
| 3 | `ADMIN` | Administrador de sede |

**File:** `03-ms-academic-db/02-dml/001-seed-academic-actor-type-table.yaml` (legado de 2 tipos) + `003-seed-admin-actor-type.yaml` (tipo `ADMIN`: vínculo admin→sede vía `academic_actor`)

---

## 5. Attendance — `attendance.justification_type` (per-school)

Types support `school_id` (`NULL` = global, `NOT NULL` = per-school custom). Global seeds are minimal; schools can add custom types via `POST justification_type`.

| ID | School | Name | Requires attachment |
|----|--------|------|---------------------|
| 1 | global | Medical leave | ✅ |
| 2 | global | Domestic calamity | ✅ |
| 3 | global | Academic commitment | ❌ |

**File:** `05-ms-attendance-db/02-dml/001-seed-justification-type-table.yaml`

**Usage:** `justification_type_id` selected on `justification` creation. Unique per `(school_id, name)` (`uq_justification_type_school_name`).

---

## 6. Configuration — `configuration.security_configuration`

Global security params. Password policy lives in `identity.password_policy`.

| ID | Parameter | Value | Description |
|----|-----------|-------|-------------|
| 1 | `session_timeout_minutes` | `480` | Session max duration (8 hours) |
| 2 | `max_login_attempts` | `5` | Max attempts before lockout |
| 3 | `lockout_duration_minutes` | `30` | Lockout duration (minutes) |

**File:** `07-ms-configuration-db/02-dml/001-seed-security-configuration-table.yaml`

---

## 7. Configuration — `configuration.academic_configuration`

Academic params per school. `school_id = 1` is the default school. Values align with frontend defaults (`front-end/Web/src/core/config/institutionConfig.js`).

| ID | School | Parameter | Value | Description |
|----|--------|-----------|-------|-------------|
| 1 | 1 | `tardy_tolerance_minutes` | `15` | Minutes after start before marking late |
| 2 | 1 | `min_attendance_percent` | `80` | Minimum attendance percentage to pass |
| 3 | 1 | `days_until_sanction` | `15` | Days before sanction is applied |
| 4 | 1 | `confidence_threshold` | `85` | Minimum facial recognition confidence (0-100) |
| 5 | 1 | `session_time_minutes` | `60` | Default session duration |

**File:** `07-ms-configuration-db/02-dml/002-seed-academic-configuration-table.yaml`

---

## 8. Identity — `identity.password_policy`

Password complexity rules. Values align with frontend defaults (`front-end/Mobile/src/models/identity/PasswordPolicy.js`).

| ID | Min Length | Max Length | Uppercase | Numbers | Symbols | Expiration Days |
|----|------------|------------|-----------|---------|---------|-----------------|
| 1 | 8 | 20 | true | true | true | 90 |

**File:** `01-ms-identity-db/02-dml/001-seed-password-policy-table.yaml`

---

## 7. Notification — `notification.alert_type`

Alert types with `severity` and `channel` for `AlertsConfigContext` mapping.

| ID | Code | Name | Severity | Channel |
|----|------|------|----------|---------|
| 1 | `ATTENDANCE_ABSENTEEISM` | Recurrent absenteeism | WARNING | DASHBOARD |
| 2 | `ATTENDANCE_TARDINESS` | Repeated tardiness | WARNING | DASHBOARD |
| 3 | `ATTENDANCE_LOW` | Low attendance rate | CRITICAL | EMAIL |
| 4 | `JUSTIFICATION_PENDING` | Pending justification review | INFO | DASHBOARD |
| 5 | `BIOMETRIC_UPDATE` | Biometric update request | INFO | PUSH |

**File:** `08-ms-notification-db/02-dml/001-seed-alert-type-table.yaml`

---

## 9. Summary by domain

| Domain | Catalog table | Records | Seed file |
|---------|---------------|:---------:|--------------|
| Authorization | `role` | 4 | `02-ms-authorization-db/02-dml/001-seed-role-table.yaml` + `004-unify-mobile-roles.yaml` + `007-split-super-admin-role.yaml` |
| Authorization | `permission` | 13 | `02-ms-authorization-db/02-dml/002-seed-permission-table.yaml` + `008-justification-request-permission.yaml` |
| Academic | `academic_actor_type` | 2 | `03-ms-academic-db/02-dml/001-seed-academic-actor-type-table.yaml` |
| Attendance | `justification_type` | 3 | `05-ms-attendance-db/02-dml/001-seed-justification-type-table.yaml` |
| Configuration | `security_configuration` | 3 | `07-ms-configuration-db/02-dml/001-seed-security-configuration-table.yaml` |
| Configuration | `academic_configuration` | 5 | `07-ms-configuration-db/02-dml/002-seed-academic-configuration-table.yaml` |
| Identity | `password_policy` | 1 | `01-ms-identity-db/02-dml/001-seed-password-policy-table.yaml` |
| Notification | `alert_type` | 5 | `08-ms-notification-db/02-dml/001-seed-alert-type-table.yaml` |

**Total: 35 seed records in 8 catalog tables.** `identity.city` removed (external API).

---

## 10. How to add new records

Seeds run once on DB creation. For post-init inserts use incremental DML:

```yaml
databaseChangeLog:
  - changeSet:
      id: 002-add-custom-justification-type
      author: YourName
      changes:
        - insert:
            tableName: justification_type
            schemaName: attendance
            columns:
              - column: { name: justification_type_id, value: 4 }
              - column: { name: school_id, value: 1 }
              - column: { name: name, value: 'Sports leave' }
              - column: { name: description, value: 'Sports competition' }
              - column: { name: requires_attachment, value: false }
              - column: { name: created_at, valueComputed: CURRENT_TIMESTAMP }
              - column: { name: updated_at, valueComputed: CURRENT_TIMESTAMP }
              - column: { name: row_version, value: 1 }
```

> `valueDate: { dateFunction: now }` is **not** valid Liquibase syntax: it compiles to
> `NULL` and breaks `created_at NOT NULL` on fresh databases. Use `valueComputed`.

> Never modify existing seed changesets in production. Always add incremental changesets.

---

## 11. Tables with ENUMs (no seeds)

| Domain | ENUM type | Values |
|---------|-----------|---------|
| Identity | `user_session_status` | Active, Closed |
| Identity | `authentication_type` | Local, Windows, External |
| Academic | `enrollment_status` | Active, Withdrawn, Completed |
| Scheduling | `class_session_status` | Open, Closed, Cancelled |
| Attendance | `attendance_status` | Present, Absent, Late, Justified |
| Attendance | `capture_method` | FACIAL, MANUAL, IOT, IMPORT |
| Attendance | `review_status` | Pending, Approved, Rejected |
| Configuration | `biometric_type` | FACIAL, FINGERPRINT |
| Configuration | `update_status` | Pending, In_Review, Approved, Rejected |
