# Guía del Modelo de Datos — FaceAttend-Edu

## 1. Visión general

FaceAttend-Edu es una plataforma de **gestión de asistencia mediante reconocimiento biométrico** para instituciones educativas. El modelo de datos soporta:

- Gestión de personas, usuarios y credenciales
- Estructura académica (sedes, programas, cohortes, cursos)
- Horarios y sesiones de clase
- Registro de asistencia con múltiples fuentes (facial, manual, IoT, import)
- Justificaciones con soporte documental
- Actualización de plantillas biométricas con flujo de aprobación (biometric_update_case unifica FACIAL/FINGERPRINT)
- Alertas y notificaciones
- Configuración académica y de seguridad

---

## 2. Bounded Contexts (Contextos delimitados)

El modelo se divide en **9 contextos**, cada uno responsable de un área de negocio
(el diagrama de abajo muestra los 8 contextos núcleo; ver §9.5 para Quality, que se
sumó después y no está dibujado aquí):

```
┌─────────────────────────────────────────────────────────────┐
│                      FACEATTEND-EDU (v4 - DBML)             │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│  IDENTITY   │ AUTHORIZATION│  ACADEMIC   │   SCHEDULING     │
│  (5 tablas) │ (4 tablas)  │ (8 tablas)  │  (3 tablas)      │
│ city        │ role        │ school      │ environment      │
│ person      │ permission  │ program     │ schedule_block   │
│ app_user*   │ role_perm.  │ acad_period │ class_session    │
│ user_session│ user_role   │ cohort      │                  │
│ pass_policy │             │ course      │                  │
│             │             │ actor_type  │                  │
│             │             │ actor       │                  │
│             │             │ enrollment  │                  │
├─────────────┼─────────────┼─────────────┼──────────────────┤
│ ATTENDANCE  │  BIOMETRIC  │ CONFIGURATION│  NOTIFICATION   │
│ (4 tablas)  │  (NoSQL)    │ (3 tablas)  │  (2 tablas)      │
│ att_record  │ facial_emb  │ acad_config │ alert_type       │
│ justif_type │ finger_emb  │ sec_config  │ alert            │
│ justification│ (MongoDB)  │ biometric_case│                │
│ sup_document│             │             │                  │
└─────────────┴─────────────┴─────────────┴──────────────────┘
* app_user.person_id UNIQUE (1:1 con person)
```

---

## 3. Contexto: Identity

**Responsabilidad:** Identidad de personas, credenciales de acceso, sesiones y políticas de contraseña.

| Tabla | Descripción | PK |
|---|---|---|
| `person` | Identidad base: documento, nombre, contacto | `person_id` (UUID) |
| `app_user` | Credenciales de acceso; 1:1 con `person` (`person_id` UNIQUE) | `user_id` (UUID) |
| `user_session` | Sesiones activas/cerradas | `session_id` (UUID) |
| `password_policy` | Reglas de complejidad de contraseña | `policy_id` (INT) |

**Relaciones internas:**
- `app_user.person_id` → `person.person_id`
- `user_session.user_id` → `app_user.user_id`

**Diseño clave:** `person` **no tiene** `school_id`. La identidad es agnóstica de sede.

---

## 4. Contexto: Authorization

**Responsabilidad:** Control de acceso basado en roles (RBAC).

| Tabla | Descripción | PK |
|---|---|---|
| `role` | Catálogo de roles del sistema | `role_id` (INT) |
| `permission` | Catálogo de permisos atómicos | `permission_id` (INT) |
| `role_permission` | Asignación N:N roles ↔ permisos | `(role_id, permission_id)` |
| `user_role` | Asignación N:N usuarios ↔ roles | `(user_id, role_id)` |

**Cross-context:**
- `user_role.user_id` → `Identity.app_user.user_id` (sin FK)

**Diseño clave:** `role` **no tiene** `school_id`. Los roles son globales.

---

## 5. Contexto: Academic

**Responsabilidad:** Estructura académica: sedes, programas, periodos, cohortes, cursos, actores y matrículas.

| Tabla | Descripción | PK |
|---|---|---|
| `school` | Sede educativa | `school_id` (INT) |
| `program` | Oferta curricular de una sede | `program_id` (INT) |
| `academic_period` | Ventana temporal (trimestre/semestre) | `academic_period_id` (INT) |
| `cohort` | Grupo de estudiantes en programa + periodo | `cohort_id` (BIGINT) |
| `course` | Materia/asignatura de un programa | `course_id` (INT) |
| `academic_actor_type` | Catálogo: STUDENT / INSTRUCTOR / ADMIN (administrador de sede) | `actor_type_id` (SMALLINT) |
| `academic_actor` | Rol que una persona cumple en una sede | `academic_actor_id` (BIGINT) |
| `enrollment` | Matrícula de actor en una cohorte | `enrollment_id` (BIGINT) |

**Relaciones internas:**
```
school → program → course
school → program → cohort ← academic_period
academic_actor → academic_actor_type
enrollment → academic_actor
enrollment → cohort
```

**Cross-context:**
- `academic_actor.person_id` → `Identity.person.person_id` (sin FK)

**Diferencias clave:**
- **`program`**: Contenedor curricular de más alto nivel ("Tecnología en Análisis de Datos")
- **`course`**: Unidad de contenido dentro de un programa ("Bases de Datos I")
- **`cohort`**: Grupo concreto de estudiantes que avanza junto ("Ficha 2691234 — ADSI — Trimestre 1 de 2026")

---

## 6. Contexto: Scheduling

**Responsabilidad:** Traduce la estructura académica en horarios y sesiones concretas.

| Tabla | Descripción | PK |
|---|---|---|
| `environment` | Espacio físico (aula, laboratorio) | `environment_id` (INT) |
| `schedule_block` | Bloque recurrente semanal | `schedule_block_id` (BIGINT) |
| `class_session` | Materialización en una fecha concreta | `class_session_id` (BIGINT) |

**Cross-context:**
- `environment.school_id` → `Academic.school.school_id`
- `schedule_block.cohort_id` → `Academic.cohort.cohort_id`
- `schedule_block.course_id` → `Academic.course.course_id`
- `schedule_block.instructor_actor_id` → `Academic.academic_actor.academic_actor_id`

**Puente hacia Attendance:** `class_session` es la entidad que recibe registros de asistencia.

---

## 7. Contexto: Attendance

**Responsabilidad:** Registro de asistencia, justificaciones y soportes documentales.

| Tabla | Descripción | PK |
|---|---|---|
| `attendance_record` | Un registro por actor y sesión | `attendance_record_id` (BIGINT) |
| `justification_type` | Catálogo de tipos de justificación | `justification_type_id` (INT) |
| `justification` | Justificación de inasistencia/tardanza | `justification_id` (BIGINT) |
| `supporting_document` | Soportes documentales adjuntos | `supporting_document_id` (BIGINT) |

**Cross-context:**
- `attendance_record.class_session_id` → `Scheduling.class_session.class_session_id`
- `attendance_record.academic_actor_id` → `Academic.academic_actor.academic_actor_id`
- `justification.reviewed_by` → `Identity.app_user.user_id`

**ENUMs:**
- `attendance_status`: Present, Absent, Late, Justified
- `capture_method`: FACIAL, MANUAL, IOT, IMPORT
- `review_status`: Pending, Approved, Rejected

---

## 8. Contexto: Biometric

**Responsabilidad:** Plantillas biométricas (facial y dactilar).

**No forma parte del esquema relacional SQL.** Se modela como colecciones NoSQL en **MongoDB** (fuera del modelo relacional DBML):

| Colección | Campos clave |
|---|---|
| `facial_embedding` | `person_id`, `template_version`, `encoding`, `model_version`, `enrolled_at`, `is_active` |
| `fingerprint_embedding` | `person_id`, `finger_number`, `template_version`, `encoding`, `model_version`, `enrolled_at`, `is_active` |

**¿Por qué NoSQL?** Los embeddings biométricos son documentos de estructura flexible y de alto volumen de lectura/escritura por reconocimiento en tiempo real.

**En PostgreSQL solo existe el schema `biometric` vacío** (`06-ms-biometric-db` solo crea el schema, sin tablas). La referencia lógica desde `configuration.biometric_update_case.current_embedding_ref` apunta al `_id` del documento en MongoDB (cross-paradigm, sin FK).

---

## 9. Contexto: Configuration

**Responsabilidad:** Parámetros configurables y casos de actualización biométrica.

| Tabla | Descripción | PK |
|---|---|---|
| `academic_configuration` | Parámetros por sede | `configuration_id` (INT) |
| `security_configuration` | Parámetros globales de seguridad | `configuration_id` (INT) |
| `biometric_update_case` | Solicitud de actualización biométrica | `case_id` (UUID) |

**`biometric_update_case`** unifica los casos de actualización facial y dactilar:
- `biometric_type`: FACIAL / FINGERPRINT (ENUM)
- `finger_number`: Solo para FINGERPRINT (1..10), nulo para FACIAL
- `current_embedding_ref`: Referencia lógica al documento activo en NoSQL

---

## 9.5 Contexto: Quality

**Responsabilidad:** Instrumento de evaluación de calidad (ISO/IEC 25010, ISO/IEC 29110,
ISTQB) sobre los demás microservicios. Dueño lógico: `09-ms-quality`; hospedaje físico
transitorio en el schema `quality` dentro de `07-ms-configuration-db`, porque no existe
un servicio `quality-liquibase` independiente — deuda documentada, no mover sin migración
compatibilizada.

| Tabla | Descripción | PK |
|---|---|---|
| `quality_project` | Proyecto de software evaluado (ISO/IEC 29110) | `project_id` (BIGINT) |
| `quality_evaluation` | Evaluación ISO/IEC 25010 de un microservicio | `evaluation_id` (BIGINT) |
| `quality_evaluation_item` | Puntaje 1-5 por subcaracterística 25010 | `evaluation_item_id` (BIGINT) |
| `process_assessment` | Valoración de proceso ISO/IEC 29110 (PM/SI) | `assessment_id` (BIGINT) |
| `process_assessment_rating` | Calificación N/P/L/F por objetivo 29110 | `process_rating_id` (BIGINT) |
| `istqb_assessment` | Evaluación ISTQB CTFL v4.0 de un microservicio | `istqb_assessment_id` (BIGINT) |
| `istqb_assessment_item` | Puntaje 1-5 por ítem ISTQB | `istqb_assessment_item_id` (BIGINT) |

Los catálogos de subcaracterísticas/objetivos/ítems (ej. `tech-bva`, `PM.O1`) viven en
código (`09-ms-quality/src/domain/{iso25010,iso29110,istqb}.ts`), no en tablas: el
instrumento es inmutable, así que no llevan FK.

---

## 10. Contexto: Notification

**Responsabilidad:** Tipos de alerta y alertas generadas sobre actores académicos.

| Tabla | Descripción | PK |
|---|---|---|
| `alert_type` | Catálogo de tipos de alerta | `alert_type_id` (SMALLINT) |
| `alert` | Alerta generada sobre un actor | `alert_id` (BIGINT) |

**Cross-context:**
- `alert.academic_actor_id` → `Academic.academic_actor.academic_actor_id`

---

## 11. Regla más importante: Sin FK entre contextos

> **Toda referencia entre contextos distintos se documenta como comentario, nunca como `Ref:` activa.**

Esto significa que en el código SQL/Liquibase:

```yaml
# ✅ CORRECTO - sin FK real
- column:
    name: person_id
    type: UUID
    remarks: "Cross-context reference to Identity.person (NO FK)"

# ❌ INCORRECTO - FK real entre contextos
- addForeignKeyConstraint:
    baseColumnNames: person_id
    referencedTableName: person
    referencedTableSchemaName: identity
```

**Excepción:** Las referencias **dentro** del mismo contexto SÍ usan FK reales (ej: `enrollment.cohort_id → cohort.cohort_id`, ambas en Academic).

---

## 12. Diagrama de relaciones (simplificado)

```
identity.person ─────────────────────────────────────────┐
    │ 1:1                                                 │
    ▼                                                    │
identity.app_user                              academic.academic_actor
    │                                                  │    │
    │ (cross-context)                                  │    │
    ▼                                                  │    │
authorization.user_role                        enrollment │
                                                  │    │    │
                                      academic.cohort ◄──┘    │
                                          │                   │
                                          │                   │
                              scheduling.schedule_block ──────┘
                                          │
                                          ▼
                              scheduling.class_session
                                          │
                                          ▼
                              attendance.attendance_record
                                          │
                                          ▼
                              attendance.justification
                                          │
                                          ▼
                              attendance.supporting_document
```

---

## 13. ENUMs del modelo

| Dominio | Tipo | Valores |
|---|---|---|
| Identity | `user_session_status` | Active, Closed |
| Identity | `authentication_type` | Local, Windows, External |
| Academic | `enrollment_status` | Active, Withdrawn, Completed |
| Scheduling | `class_session_status` | Open, Closed, Cancelled |
| Attendance | `attendance_status` | Present, Absent, Late, Justified |
| Attendance | `capture_method` | FACIAL, MANUAL, IOT, IMPORT |
| Attendance | `review_status` | Pending, Approved, Rejected |
| Configuration | `biometric_type` | FACIAL, FINGERPRINT |
| Configuration | `update_status` | Pending, In_Review, Approved, Rejected |
