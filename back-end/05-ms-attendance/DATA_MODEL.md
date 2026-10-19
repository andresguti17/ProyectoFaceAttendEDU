# DATA_MODEL — 05-ms-attendance

> **Servicio:** `05-ms-attendance` · **Schema:** `attendance` · **Puerto ADR-005:** `8085`
> **Fuente canónica:** `../database/05-ms-attendance-db/01-ddl/03-tables/` + `../../fae-docs/06-data/domains/05-attendance.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **Stack:** `Java 21 + Spring Boot 4.1.1` → `../../fae-docs/_stacks/java-spring.md`

## Responsabilidad

Asistencia: attendance_record, justificaciones y soportes. Ver `../../fae-docs/06-data/domains/05-attendance.md` para modelo lógico completo y `../database/05-ms-attendance-db` para DDL Liquibase.

## Tablas / Colecciones

Ver detalle canónico en:

- **Liquibase DDL:** `../database/05-ms-attendance-db/01-ddl/03-tables/*.yaml` (crear tablas + constraints + índices)
- **Dominio lógico:** `../../fae-docs/06-data/domains/05-attendance.md` (SQL CREATE TABLE + data dictionary + decisions)
- **Guía global:** `../database/ESTRUCTURA.md`, `../database/MODELO.md`, `../DATABASE.md`

> Este archivo es índice de acople. El contenido normativo vive en `../../fae-docs/06-data/domains/05-attendance.md` y en el DDL de `../database/05-ms-attendance-db`. No duplicar aquí el DDL completo para evitar drift.

### Checklist de verificación

- [ ] `../database/05-ms-attendance-db/changelog/changelog-master.yaml` incluye `01-ddl → 02-dml → 03-dcl → 04-tcl`
- [ ] Tablas en `../../fae-docs/06-data/domains/05-attendance.md` coinciden con `../database/05-ms-attendance-db/01-ddl/03-tables/`
- [ ] Cross-context refs sin FK real (solo comentarios `remarks: Cross-context reference ... NO FK`)
- [ ] Audit fields en todas las tablas: `created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`

## Relación con otros contextos

Ver `../../fae-docs/06-data/domains/05-attendance.md` § Design Principles y `../database/MODELO.md` §11 (Sin FK entre contextos).
