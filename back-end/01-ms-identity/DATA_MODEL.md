# DATA_MODEL — 01-ms-identity

> **Servicio:** `01-ms-identity` · **Schema:** `identity` · **Puerto ADR-005:** `8081`
> **Fuente canónica:** `../database/01-ms-identity-db/01-ddl/03-tables/` + `../../fae-docs/06-data/domains/01-identity.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **Stack:** `Java 21 + Spring Boot 4.1.1` → `../../fae-docs/_stacks/java-spring.md`

## Responsabilidad

Identidad, personas, credenciales, sesiones y password_policy. Ver `../../fae-docs/06-data/domains/01-identity.md` para modelo lógico completo y `../database/01-ms-identity-db` para DDL Liquibase.

## Tablas / Colecciones

Ver detalle canónico en:

- **Liquibase DDL:** `../database/01-ms-identity-db/01-ddl/03-tables/*.yaml` (crear tablas + constraints + índices)
- **Dominio lógico:** `../../fae-docs/06-data/domains/01-identity.md` (SQL CREATE TABLE + data dictionary + decisions)
- **Guía global:** `../database/ESTRUCTURA.md`, `../database/MODELO.md`, `../DATABASE.md`

> Este archivo es índice de acople. El contenido normativo vive en `../../fae-docs/06-data/domains/01-identity.md` y en el DDL de `../database/01-ms-identity-db`. No duplicar aquí el DDL completo para evitar drift.

### Checklist de verificación

- [ ] `../database/01-ms-identity-db/changelog/changelog-master.yaml` incluye `01-ddl → 02-dml → 03-dcl → 04-tcl`
- [ ] Tablas en `../../fae-docs/06-data/domains/01-identity.md` coinciden con `../database/01-ms-identity-db/01-ddl/03-tables/`
- [ ] Cross-context refs sin FK real (solo comentarios `remarks: Cross-context reference ... NO FK`)
- [ ] Audit fields en todas las tablas: `created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, row_version`

## Relación con otros contextos

Ver `../../fae-docs/06-data/domains/01-identity.md` § Design Principles y `../database/MODELO.md` §11 (Sin FK entre contextos).
