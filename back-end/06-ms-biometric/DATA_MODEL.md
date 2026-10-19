# DATA_MODEL — 06-ms-biometric

> **Servicio:** `06-ms-biometric` · **Schema:** `biometric (vacío) + MongoDB` · **Puerto ADR-005:** `8086`
> **Fuente canónica:** `../database/06-ms-biometric-db/01-ddl/03-tables/` + `../../fae-docs/06-data/domains/06-biometric.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **Stack:** `Python 3.12 + FastAPI` → `../../fae-docs/_stacks/python-fastapi.md`

## Responsabilidad

Embeddings faciales/dactilares (MongoDB) + caso en configuration. Ver `../../fae-docs/06-data/domains/06-biometric.md` para modelo lógico completo y `../database/06-ms-biometric-db` para DDL Liquibase.

## Tablas / Colecciones

Ver detalle canónico en:

- **Liquibase DDL:** `../database/06-ms-biometric-db/01-ddl/03-tables/*.yaml` (crear tablas + constraints + índices)
- **Dominio lógico:** `../../fae-docs/06-data/domains/06-biometric.md` (SQL CREATE TABLE + data dictionary + decisions)
- **Guía global:** `../database/ESTRUCTURA.md`, `../database/MODELO.md`, `../DATABASE.md`

> Este archivo es índice de acople. El contenido normativo vive en `../../fae-docs/06-data/domains/06-biometric.md` y en el DDL de `../database/06-ms-biometric-db`. No duplicar aquí el DDL completo para evitar drift.

### Checklist de verificación

- [ ] `../database/06-ms-biometric-db/changelog/changelog-master.yaml` incluye `01-ddl → 02-dml → 03-dcl → 04-tcl`
- [ ] Tablas en `../../fae-docs/06-data/domains/06-biometric.md` coinciden con `../database/06-ms-biometric-db/01-ddl/03-tables/`
- [ ] Cross-context refs sin FK real (solo comentarios `remarks: Cross-context reference ... NO FK`)
- [ ] Audit fields en todas las tablas: `created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`

## Relación con otros contextos

Ver `../../fae-docs/06-data/domains/06-biometric.md` § Design Principles y `../database/MODELO.md` §11 (Sin FK entre contextos).
