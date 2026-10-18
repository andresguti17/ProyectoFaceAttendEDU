# Seed API test data

Seed script that creates test data across all FaceAttendEDU microservices so
web (`front-end/Web`) and mobile (`front-end/Mobile`) can test real
frontend-backend communication at volume. Node >= 20, zero dependencies.

Scale: **2 colombian high schools, 1600 students, 80 teachers, ~1210 class
sessions and ~81k attendance records** inside a pinned 4-week window, sized to
exercise list, filter and dashboard performance.

## Run

```bash
# from the repo root
docker compose up -d

cd tools/seed-api-test-data
cp .env.example .env   # adjust host/ports if needed
npm run seed           # or: node seed.mjs
```

Exit code is `0` when every request succeeds or only hits a documented known
backend bug (reported as `WARN`). Any other failure exits `1` with details.

Reruns are cheap and idempotent: each service's full collection is indexed
once at the start of its phase (paged `?page`/`?limit` or `?limit`/`?offset`
where supported), so a second run skips every create instead of churning
409s. `409 Conflict` is still treated as "already exists" as a fallback, and
chained ids are resolved from the indexes.

Tunables (`.env` or environment):

| Variable | Default | Meaning |
|---|---|---|
| `SEED_CONCURRENCY` | `8` | parallel request pool (a full run is ~13k requests, ≈3-6 min) |
| `SEED_VERBOSE` | `0` | `1` logs every successful request; failures always log |
| `TEACHER_PASSWORD` | `Docente2026*` | password shared by the 80 seeded teacher logins |

## Date window (important)

Dates are **pinned constants** so reruns request the same data:

| What | Date |
|---|---|
| Academic period `2026-II` | `2026-09-07` → `2026-12-18` (active) |
| Enrollments / actor start (`enrolledOn`, `startedOn`) | `2026-09-07` |
| Class sessions | every block weekday between `2026-09-07` and `2026-10-05` |
| Session status | older sessions `Closed` (with `closedBy`), `2026-10-05` stays `Open` |

The API does not accept backdated timestamps for attendance `capturedAt`,
justification `submittedAt` or alert `raisedAt` (the server stamps them), so
historical reporting comes from the session dates those records hang on.

## Why direct microservice URLs

The script targets microservice ports (`8081`-`8089`) instead of the
Kong gateway (`:8000`) because most gateway routes require a JWT. Apps keep
using the gateway. Override any target in `.env` (`IDENTITY_URL`, ...); the
local `.env` is loaded automatically (older Node versions fall back to the
built-in defaults).

## Pointing the apps at the backend

Web (`front-end/Web`, see `src/config/env.ts`):

```bash
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start --web
```

Mobile (`front-end/Mobile`, see `src/config/env.js`): on a physical device
or emulator `localhost` is the phone itself, so use the PC LAN IP:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000 npx expo start
```

Login smoke test: `POST /api/v1/auth/login` then browse schools, sessions,
alerts and quality instruments created below.

## Seeded data

| Service | Records |
|---|---|
| identity `:8081` | 3 cities (Bogotá, Medellín, Cali), ~1690 persons (1600 students TI/CC + 80 teachers + staff) — every one with email, phone, address, birth date and blood type, ~2% inactive —, 83 users (3 demo logins + 80 teachers), `/me` checks |
| authorization `:8082` | roles `Super Administrador`/`Administrador`/`Instructor`/`Aprendiz`, every demo login and all 80 teachers assigned (the bootstrap admin gets `Super Administrador`), 2 permissions |
| academic `:8083` | 2 schools (`ICT-01` Bogotá, `SMP-02` Medellín; legacy `ANDES-01`/`SAM-02`/`ROS-03`/`SEED-SCH` soft-disabled), 4 programs (2 énfasis per school), period `2026-II`, 24 cohorts (grados 6°-11° A/B, ≈67 students each), 48 courses, 1680 actors (`EST-*`/`DOC-*`), 1600 enrollments (~95% Active, ~3% Withdrawn, ~2% Completed) |
| scheduling `:8084` | 24 environments (12 per school), 288 weekly blocks (12 per cohort), ~1210 sessions (4-5 dates per block) |
| attendance `:8085` | roll call per session via bulk (~81k records, 80% Present / 8% Late / 12% Absent; Present/Late mix FACIAL/MANUAL/IOT/IMPORT with a match score only on FACIAL, absences are MANUAL/IMPORT with no capture), 3 justification types (plus legacy ones disabled), ~300 justifications split ~45% Approved / ~20% Rejected / rest Pending |
| biometric `:8086` | facial enroll for every student and teacher (person UUID) + legacy `seed-student-01`/`est-2026-00x`, verify, identify, history |
| configuration `:8087` | 3 attendance configs per school, 3 security configs, up to 10 pending biometric update cases |
| notification `:8088` | reuses the Liquibase catalog types `ATTENDANCE_ABSENTEEISM`/`ATTENDANCE_TARDINESS`/`ATTENDANCE_LOW` (it no longer creates duplicates), ~467 alerts (rules: seq % 7 / % 11 / % 17), 1 in 3 resolved |
| quality `:8089` | 2 projects, characteristics/process/istqb instruments |

Reruns also normalise data created by earlier runs: person attributes are
backfilled, enrollment and review states get spread, duplicate demo catalog
rows are soft-disabled and alerts raised against the old duplicate types are
removed. The one thing a rerun cannot repair is `captured_at` on attendance
records that already exist (no endpoint clears it), so absences seeded before
this change keep their capture timestamp until attendance is seeded from an
empty database.

Demo logins (local testing only, also documented in a comment in `seed.mjs`):

Scoped to a school — the web app reads the school from the account's
`academic_actor` and shows only that institution:

| Rol | Sede | Persona | Username | Password |
|---|---|---|---|---|
| Administrador | Camilo Torres (`ICT-01`) | Marcela Quintero Pardo | `admin.ict` | `Rector2026*` |
| Administrador | San Martín (`SMP-02`) | Hernán Ocampo Zuluaga | `admin.smp` | `Rector2026*` |
| Docente | Camilo Torres | Valentina García Hernández | `valentina.garcia` | `Docente2026*` |
| Docente | San Martín | Valentina García Hernández | `valentina.garcia2` | `Docente2026*` |
| Estudiante | Camilo Torres | Valentina García Ortiz | `est.ict` | `Estudiante2026*` |
| Estudiante | San Martín | Valentina Rendón Ortiz | `est.smp` | `Estudiante2026*` |

Not scoped — these have no `academic_actor`, so they see every school:

| Rol | Persona | Username | Password |
|---|---|---|---|
| Administrador | Carolina Mendoza Ruiz | `carolina.mendoza` | `Admin2026*` |
| Docente | Carlos Restrepo Álvarez | `carlos.restrepo` | `Docente2026*` |
| Estudiante | Valentina Ríos Herrera | `valentina.rios` | `Estudiante2026*` |
| Docentes (80) | generated roster | `nombre.apellido` (p. ej. `gabriel.restrepo`) | `Docente2026*` |

`POST /api/v1/users` bcrypt-hashes the password server side, so
the plaintext is never stored or returned. Override via `SEED_USERNAME` /
`SEED_PASSWORD`, `INSTRUCTOR_USERNAME` / `INSTRUCTOR_PASSWORD`,
`STUDENT_USERNAME` / `STUDENT_PASSWORD` or `TEACHER_PASSWORD` per environment
and never reuse these values outside local testing.

## ID mapping

`academic.academic_actor.person_id` is a native UUID column (cross-context
reference to `identity.person`, no FK), so the seed reuses the `personId` UUIDs
returned by `POST identity/api/v1/persons`. Biometric enrollments now use the
same person UUID, plus the legacy string ids `seed-student-01` and
`est-2026-00x` kept for old dashboards; the link between them is conventional,
not a FK. Student document numbers are deterministic (`TI` for grados 6°-9°,
`CC` for 10°-11°), and usernames/email derive from the generated names, so
reruns always address the same rows.

## Known backend bugs

None currently whitelisted in `seed.mjs` (`KNOWN_ISSUES` is empty), so any failure
fails the seed with exit code `1`.

Previously tracked here and now fixed:

1. `POST /api/v1/users` returned `400 User.passwordHash is required`. The endpoint
   now takes `{ personId, username, password }`, hashes with bcrypt cost 12 and
   returns `201`.
2. `POST` writes on scheduling/attendance hung until client timeout because their
   Kafka producer dialled `localhost:9092`. `back-end/docker-compose.yml` now sets
   `SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:29092` for `ms-scheduling` and
   `ms-attendance`, and their JDBC URLs keep `?stringtype=unspecified` so `String`
   values still coerce into native PostgreSQL enum columns.
3. The old script pre-posted a single attendance record before the bulk loop;
   the bulk for that session then hit the unique constraint and rolled back
   entirely, leaving that session with 1 record instead of the full roster.
   The rewritten script only creates records through the bulk call.

Note: the first write that publishes to Kafka pays a one-off producer
initialisation cost, so the request timeout is 30s rather than 10s.
