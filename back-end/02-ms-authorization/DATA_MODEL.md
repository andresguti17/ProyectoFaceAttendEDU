# DATA_MODEL — 02-ms-authorization

> **Servicio:** `02-ms-authorization` · **Schema:** `authorization` · **Puerto ADR-005:** `8082`
> **Fuente canónica:** `../database/02-ms-authorization-db/01-ddl/03-tables/` + `../../fae-docs/06-data/domains/02-authorization.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **Stack:** `Java 21 + Spring Boot 4.1.1` → `../../fae-docs/_stacks/java-spring.md`

## Responsabilidad

RBAC: roles, permisos y asignaciones usuario-rol. Ver `../../fae-docs/06-data/domains/02-authorization.md` para modelo lógico completo y `../database/02-ms-authorization-db` para DDL Liquibase.

## Tablas / Colecciones

Ver detalle canónico en:

- **Liquibase DDL:** `../database/02-ms-authorization-db/01-ddl/03-tables/*.yaml` (crear tablas + constraints + índices)
- **Dominio lógico:** `../../fae-docs/06-data/domains/02-authorization.md` (SQL CREATE TABLE + data dictionary + decisions)
- **Guía global:** `../database/ESTRUCTURA.md`, `../database/MODELO.md`, `../DATABASE.md`

> Este archivo es índice de acople. El contenido normativo vive en `../../fae-docs/06-data/domains/02-authorization.md` y en el DDL de `../database/02-ms-authorization-db`. No duplicar aquí el DDL completo para evitar drift.

### Checklist de verificación

- [ ] `../database/02-ms-authorization-db/changelog/changelog-master.yaml` incluye `01-ddl → 02-dml → 03-dcl → 04-tcl`
- [ ] Tablas en `../../fae-docs/06-data/domains/02-authorization.md` coinciden con `../database/02-ms-authorization-db/01-ddl/03-tables/`
- [ ] Cross-context refs sin FK real (solo comentarios `remarks: Cross-context reference ... NO FK`)
- [ ] Audit fields en todas las tablas: `created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`

## Relación con otros contextos

Ver `../../fae-docs/06-data/domains/02-authorization.md` § Design Principles y `../database/MODELO.md` §11 (Sin FK entre contextos).
