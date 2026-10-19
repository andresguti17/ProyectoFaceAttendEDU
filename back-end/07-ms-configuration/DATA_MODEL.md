# DATA_MODEL — 07-ms-configuration

> **Servicio:** `07-ms-configuration` · **Schema:** `configuration` · **Puerto ADR-005:** `8087`
> **Fuente canónica:** `../database/07-ms-configuration-db/01-ddl/03-tables/` + `../../fae-docs/06-data/domains/08-configuration.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **Stack:** `TypeScript + Fastify` → `../../fae-docs/_stacks/node-typescript.md`

## Responsabilidad

Parámetros académicos/seguridad y biometric_update_case. Ver `../../fae-docs/06-data/domains/08-configuration.md` para modelo lógico completo y `../database/07-ms-configuration-db` para DDL Liquibase.

## Tablas / Colecciones

Ver detalle canónico en:

- **Liquibase DDL:** `../database/07-ms-configuration-db/01-ddl/03-tables/*.yaml` (crear tablas + constraints + índices)
- **Dominio lógico:** `../../fae-docs/06-data/domains/08-configuration.md` (SQL CREATE TABLE + data dictionary + decisions)
- **Guía global:** `../database/ESTRUCTURA.md`, `../database/MODELO.md`, `../DATABASE.md`

> Este archivo es índice de acople. El contenido normativo vive en `../../fae-docs/06-data/domains/08-configuration.md` y en el DDL de `../database/07-ms-configuration-db`. No duplicar aquí el DDL completo para evitar drift.

### Checklist de verificación

- [ ] `../database/07-ms-configuration-db/changelog/changelog-master.yaml` incluye `01-ddl → 02-dml → 03-dcl → 04-tcl`
- [ ] Tablas en `../../fae-docs/06-data/domains/08-configuration.md` coinciden con `../database/07-ms-configuration-db/01-ddl/03-tables/`
- [ ] Cross-context refs sin FK real (solo comentarios `remarks: Cross-context reference ... NO FK`)
- [ ] Audit fields en todas las tablas: `created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`

## Relación con otros contextos

Ver `../../fae-docs/06-data/domains/08-configuration.md` § Design Principles y `../database/MODELO.md` §11 (Sin FK entre contextos).

