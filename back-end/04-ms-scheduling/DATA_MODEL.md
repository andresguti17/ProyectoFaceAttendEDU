# DATA_MODEL — 04-ms-scheduling

> **Servicio:** `04-ms-scheduling` · **Schema:** `scheduling` · **Puerto ADR-005:** `8084`
> **Fuente canónica:** `../database/04-ms-scheduling-db/01-ddl/03-tables/` + `../../fae-docs/06-data/domains/04-scheduling.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **Stack:** `Java 21 + Spring Boot 4.1.1` → `../../fae-docs/_stacks/java-spring.md`

## Responsabilidad

Horarios: environment, schedule_block, class_session (anti-double-booking). Ver `../../fae-docs/06-data/domains/04-scheduling.md` para modelo lógico completo y `../database/04-ms-scheduling-db` para DDL Liquibase.

## Tablas / Colecciones

Ver detalle canónico en:

- **Liquibase DDL:** `../database/04-ms-scheduling-db/01-ddl/03-tables/*.yaml` (crear tablas + constraints + índices)
- **Dominio lógico:** `../../fae-docs/06-data/domains/04-scheduling.md` (SQL CREATE TABLE + data dictionary + decisions)
- **Guía global:** `../database/ESTRUCTURA.md`, `../database/MODELO.md`, `../DATABASE.md`

> Este archivo es índice de acople. El contenido normativo vive en `../../fae-docs/06-data/domains/04-scheduling.md` y en el DDL de `../database/04-ms-scheduling-db`. No duplicar aquí el DDL completo para evitar drift.

### Checklist de verificación

- [ ] `../database/04-ms-scheduling-db/changelog/changelog-master.yaml` incluye `01-ddl → 02-dml → 03-dcl → 04-tcl`
- [ ] Tablas en `../../fae-docs/06-data/domains/04-scheduling.md` coinciden con `../database/04-ms-scheduling-db/01-ddl/03-tables/`
- [ ] Cross-context refs sin FK real (solo comentarios `remarks: Cross-context reference ... NO FK`)
- [ ] Audit fields en todas las tablas: `created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`

## Relación con otros contextos

Ver `../../fae-docs/06-data/domains/04-scheduling.md` § Design Principles y `../database/MODELO.md` §11 (Sin FK entre contextos).
