---
name: faceattend-local-env
description: Use when starting, seeding, backing up, or running tests against the local FaceAttend-EDU docker-compose stack, or when verifying a change against the real per-service test suites before a PR.
---

# Entorno local y verificación (docker compose, seeds, tests)

## Overview
Hoy solo existe el entorno `local` (`fae-docs/10-devops/environments.md`): no hay pipeline de despliegue, dev/staging/prod están "planeados". Todo "deploy" real es `docker compose up -d --build` manual. No inventes comandos de despliegue más allá de esto.

## Cuándo usar
Necesitas levantar el stack completo o parcial, poblar datos de prueba, respaldar/restaurar, o correr la misma verificación que corre el CI antes de un PR.

## Arranque
```bash
docker compose up -d --build        # desde FULL/: stack completo (database + back-end + frontend-web)
```
El compose raíz encadena los contenedores `<schema>-liquibase` en orden `identity → authorization → academic → scheduling → attendance → biometric → configuration → notification` antes de los microservicios de app (`ms-quality` depende de `notification-liquibase`, no tiene changelog propio). 3 redes: `faceattend-edge`, `faceattend-app`, `faceattend-data` (detalle en `COMPOSE.md`).

Por piezas:
```bash
cd database && docker compose up -d                 # solo Postgres 17 + 8 Liquibase
cd back-end/99-api-gateway && docker compose up -d   # solo Kong (requiere el stack ya arriba)
```

Servicio individual sin Docker:
```bash
./mvnw spring-boot:run                          # Java: 01,02,04,05
npm run dev                                     # TS: 03,07,09
uvicorn main:app --reload --port 8086           # Python: 06 (dentro del venv de poetry)
go run cmd/server/main.go                       # Go: 08
```

## Seed de datos de prueba
```bash
cd tools/seed-api-test-data
cp .env.example .env
npm run seed        # node seed.mjs, requiere Node >=20, sin dependencias
```
Pobla vía las APIs REST de cada servicio (puertos 8081-8089, evitando Kong) ~1600 estudiantes, 80 docentes, ~1210 sesiones y ~81k registros de asistencia en la ventana fija 2026-09-07/2026-10-05. Es idempotente (indexa antes de crear, trata 409 como "ya existe"). Variables en `.env`: `IDENTITY_URL` (y equivalentes por servicio), `SEED_CONCURRENCY`, `SEED_VERBOSE`, `TEACHER_PASSWORD`. El `README.md` de la herramienta dice que evita Kong "porque la mayoría de rutas exigen JWT" — esa frase parece terminología informal/desactualizada: el modelo real de auth es sessionId opaco, no JWT (ver skill `faceattend-api-conventions`).

## Backup / restore
```bash
database/scripts/backup.sh     # pg_dump (formato custom) desde el contenedor faceattend-postgres + volcado Mongo, a database/backups/<timestamp>/ (configurable con BACKUP_DIR)
database/scripts/restore.sh    # contraparte — no se verificó su contenido completo
```
Requieren el stack arriba.

## Verificar estado
```bash
docker exec -it faceattend-postgres psql -U postgres -d faceattend_db
\dn
\dt academic.*
curl http://localhost:8000/api/v1/persons   # via Kong
```
Para la verificación completa de integridad del modelo (FKs cross-schema prohibidas, bloque de auditoría en todas las tablas) usa las queries de AGENTS.md §9 — no las dupliques aquí.

## Tests por servicio (igual que `.github/workflows/ci.yml`)
| Stack | Servicios | Comando |
|---|---|---|
| Java | 01,02,04,05 | `mvn -B test` |
| TypeScript | 03,07,09 | `npm ci && npm test && npm run build` |
| Python | 06 | `poetry install --no-root && poetry run pytest` |
| Go | 08 | `go test ./...` |
| Mobile | front-end/Mobile | `npm ci && npm test` |
| Web | front-end/Web | `npm ci && npm test && npx expo export --platform web` |

Ningún job de CI construye ni publica imágenes Docker; no hay step de deploy. Si vas a confirmar que un cambio no rompe nada antes de un PR, corre el comando de la fila correspondiente al servicio que tocaste.

## Restricciones
- No corras `backup.sh`/`restore.sh` de forma destructiva sobre datos del usuario sin confirmar antes.
- No "arregles" ni pobles las carpetas vacías anómalas (`back-end/06-ms-biometric;C`, `back-end/08-ms-notification;C`, `database/0N-ms-*-db;C`) — son artefactos de filesystem sin origen verificado, no estructura real del proyecto.
- No inventes un pipeline de CI/CD de despliegue que no existe; el único real es `.github/workflows/ci.yml` (build+test, sin deploy).

## Dudas/pendientes
- No se verificó el contenido completo de `restore.sh`.
- El wording "JWT" en el README de `seed-api-test-data` parece desactualizado frente al modelo real de sesión opaca — no se confirmó si tiene otro significado interno no documentado.
