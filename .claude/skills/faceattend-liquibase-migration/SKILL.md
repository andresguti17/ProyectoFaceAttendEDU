---
name: faceattend-liquibase-migration
description: Use when the user explicitly asks to add or modify a Liquibase changeset under database/NN-ms-*-db/ or a service's own db/changelog tree, after the DBML already defines the change.
---

# Migraciones Liquibase

## Overview
Esta skill es **solo operativa** (cómo escribir el changeset), no de modelado: por AGENTS.md, el DBML (`database/faceattend_edu_mr_v4.dbml`) manda y los archivos Liquibase están fuera de alcance como fuente de diseño — se tocan únicamente cuando el usuario lo pide explícitamente, y siempre después de actualizar el DBML.

## Cuándo usar
El usuario pide explícitamente crear/modificar un changeset Liquibase para un cambio que ya existe en el DBML.

## Convenciones verificadas
- Carpeta real por schema: `database/NN-ms-*-db/{01-ddl,02-dml,03-dcl,04-tcl,05-rollbacks}/...` con subcarpetas temáticas confirmadas en `01-ms-identity-db`: `01-ddl/{00-extensions,01-schemas,02-types,03-tables,04-views,05-materialized-views,06-functions,07-procedures,08-triggers,09-indexes}`, `02-dml/{00-inserts,01-updates,02-deletes,03-upserts,04-patches}`, `03-dcl/{00-roles,01-grants,02-policies}`, `04-tcl/{...}`, `05-rollbacks/` (espejo de todo).
- Naming: `NNN-<verbo>-<objeto>.yaml`, numeración secuencial de 3 dígitos **por subcarpeta** (ej. `002-create-person-table.yaml`, `008-drop-city-table.yaml`, `001-bootstrap-admin-user.yaml`).
- Formato casi siempre YAML (Liquibase changelog format); SQL crudo solo para funciones/triggers Postgres sin changeType declarativo (ej. `04-tcl/001-create-audit-timestamps-function.sql` + su par `...-rollback.sql`, invocado desde `001-triggers-audit-timestamps.yaml`).
- El changelog maestro de cada schema vive en `database/NN-ms-*-db/changelog/changelog-master.yaml` e incluye los `changelog.yaml` de cada subcarpeta. **El orden exacto en que enlaza `01-ddl`/`02-dml`/`04-tcl` no quedó completamente verificado** (hay indicios de que el trigger de auditoría de `04-tcl` debe preceder a los INSERTs de `02-dml`, pero no se confirmó el orden literal del archivo) — abre el `changelog-master.yaml` real del schema que vayas a tocar y replica el patrón de inclusión y el comentario que ya exista ahí; no asumas un orden fijo por esta skill.
- Existe un segundo árbol de changelog por servicio Java en `back-end/0N-ms-*/src/main/resources/db/changelog/db.changelog-master.yaml` (naming distinto: `db.changelog-master.yaml`, no `changelog-master.yaml`) — **no está confirmado si corre en runtime**; el `docker-compose.yml` de `database/` solo monta `database/NN-ms-*-db`, así que el árbol embebido en `back-end/` parece no estar wireado al compose actual. Si el usuario pide un changeset y no es obvio en cuál de los dos árboles debe ir, pregúntalo.
- Wiring real: `database/docker-compose.yml` define un servicio `<schema>-liquibase` por microservicio (imagen `liquibase/liquibase:4.29.0`, monta `./NN-ms-*-db:/liquibase/project`, `--searchPath=/liquibase/project`); el `docker-compose.yml` raíz encadena esos servicios con `depends_on` en orden `identity → authorization → academic → scheduling → attendance → biometric → configuration → notification` antes de levantar los microservicios de app (`ms-quality` depende de `notification-liquibase` por no tener changelog propio).

## Guía
1. Confirma que el campo/tabla ya existe en el DBML y en `MODELO.md`/`CONVENCIONES.md` (checklist AGENTS.md §8) — si no, indícale al usuario que falta ese paso primero.
2. Crea el changeset en la subcarpeta temática correcta (`01-ddl/03-tables`, `02-dml/00-inserts`, etc.) con el siguiente número de 3 dígitos disponible en esa subcarpeta.
3. Crea el rollback espejo en `05-rollbacks/` con el mismo número/nombre.
4. Añade la referencia del nuevo archivo al `changelog.yaml` de esa subcarpeta (no al master directamente, salvo que el patrón existente ya lo haga así).
5. Nunca edites un changeset ya aplicado/mergeado; añade uno nuevo incremental (igual que con los seeds, AGENTS.md checklist §9).

## Restricciones
- Nunca toques los seeds existentes (`SEEDS.md` — solo changesets incrementales nuevos).
- Nunca borres filas físicamente vía DML; todo borrado es `deleted_at` (soft delete, AGENTS.md §2.2/§6.11).
- No mezcles FK reales entre schemas distintos (AGENTS.md §2.1).

## Verificación
```bash
cd database && docker compose up -d   # levanta Postgres 17 + los contenedores <schema>-liquibase
docker exec -it faceattend-postgres psql -U postgres -d faceattend_db
\dt <schema>.*
```
Revisa los logs del contenedor (`docker compose logs <schema>-liquibase`) para confirmar que el changeset nuevo corrió sin error.

## Dudas/pendientes
- Orden exacto de inclusión en `changelog-master.yaml` (ver arriba).
- Cuál de los dos árboles de changelog (`database/` vs `back-end/<servicio>/.../db/changelog`) es el "vivo" para servicios distintos de identity — solo se verificó identity con certeza.
