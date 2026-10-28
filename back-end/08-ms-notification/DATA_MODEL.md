# DATA_MODEL — 08-ms-notification

> **Servicio:** `08-ms-notification` · **Schema:** `notification` · **Puerto ADR-005:** `8088`
> **Fuente canónica:** `../database/08-ms-notification-db/01-ddl/03-tables/` + `../../fae-docs/06-data/domains/07-notification.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **Stack:** `TypeScript + Fastify` → `../../fae-docs/_stacks/node-typescript.md`

## Responsabilidad

Alertas: alert_type y alert sobre academic_actor. Ver `../../fae-docs/06-data/domains/07-notification.md` para modelo lógico completo y `../database/08-ms-notification-db` para DDL Liquibase.

## Tablas / Colecciones

Ver detalle canónico en:

- **Liquibase DDL:** `../database/08-ms-notification-db/01-ddl/03-tables/*.yaml` (crear tablas + constraints + índices)
- **Dominio lógico:** `../../fae-docs/06-data/domains/07-notification.md` (SQL CREATE TABLE + data dictionary + decisions)
- **Guía global:** `../database/ESTRUCTURA.md`, `../database/MODELO.md`, `../DATABASE.md`

> Este archivo es índice de acople. El contenido normativo vive en `../../fae-docs/06-data/domains/07-notification.md` y en el DDL de `../database/08-ms-notification-db`. No duplicar aquí el DDL completo para evitar drift.

### Checklist de verificación

- [ ] `../database/08-ms-notification-db/changelog/changelog-master.yaml` incluye `01-ddl → 02-dml → 03-dcl → 04-tcl`
- [ ] Tablas en `../../fae-docs/06-data/domains/07-notification.md` coinciden con `../database/08-ms-notification-db/01-ddl/03-tables/`
- [ ] Cross-context refs sin FK real (solo comentarios `remarks: Cross-context reference ... NO FK`)
- [ ] Audit fields en todas las tablas: `created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`

## Relación con otros contextos

Ver `../../fae-docs/06-data/domains/07-notification.md` § Design Principles y `../database/MODELO.md` §11 (Sin FK entre contextos).

