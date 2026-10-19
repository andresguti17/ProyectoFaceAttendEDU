# DATA_MODEL — 03-ms-academic

> **Servicio:** `03-ms-academic` · **Schema:** `academic` · **Puerto ADR-005:** `8083`
> **Fuente canónica:** `../database/03-ms-academic-db/01-ddl/03-tables/` + `../../fae-docs/06-data/domains/03-academic.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **Stack:** `TypeScript + Fastify + Drizzle` → `../../fae-docs/_stacks/node-typescript.md`

## Responsabilidad

Estructura académica: school, program, period, cohort, course, actor, enrollment. Ver `../../fae-docs/06-data/domains/03-academic.md` para modelo lógico completo y `../database/03-ms-academic-db` para DDL Liquibase.

## Tablas / Colecciones

Ver detalle canónico en:

- **Liquibase DDL:** `../database/03-ms-academic-db/01-ddl/03-tables/*.yaml` (crear tablas + constraints + índices)
- **Dominio lógico:** `../../fae-docs/06-data/domains/03-academic.md` (SQL CREATE TABLE + data dictionary + decisions)
- **Guía global:** `../database/ESTRUCTURA.md`, `../database/MODELO.md`, `../DATABASE.md`

> Este archivo es índice de acople. El contenido normativo vive en `../../fae-docs/06-data/domains/03-academic.md` y en el DDL de `../database/03-ms-academic-db`. No duplicar aquí el DDL completo para evitar drift.

### Checklist de verificación

- [ ] `../database/03-ms-academic-db/changelog/changelog-master.yaml` incluye `01-ddl → 02-dml → 03-dcl → 04-tcl`
- [ ] Tablas en `../../fae-docs/06-data/domains/03-academic.md` coinciden con `../database/03-ms-academic-db/01-ddl/03-tables/`
- [ ] Cross-context refs sin FK real (solo comentarios `remarks: Cross-context reference ... NO FK`)
- [ ] Audit fields en todas las tablas: `created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`

## Relación con otros contextos

Ver `../../fae-docs/06-data/domains/03-academic.md` § Design Principles y `../database/MODELO.md` §11 (Sin FK entre contextos).
