# Notification service (`08-ms-notification`) — Go → TypeScript rewrite

Date: 2026-10-18
Status: Approved for planning

## 1. Goal

Rewrite `back-end/08-ms-notification` from Go 1.22/Gin to TypeScript, using the
same stack and structure as `03-ms-academic` (Fastify + Drizzle, hexagonal).
From now on Notification is developed in TypeScript — this closes out the Go
implementation entirely rather than running both side by side.

Scope is **functional parity**: every endpoint, validation rule, and behavior
the Go service has today must exist in the TypeScript version. No new
features. Opportunistic improvements are allowed only where idiomatic TS
makes something obviously simpler (e.g. replacing hand-rolled JSON error
shapes with the pattern already used in `03-ms-academic`/`07-ms-configuration`) —
not a deliberate hunt for technical debt.

## 2. Current behavior (Go/Gin) — what must be preserved

### 2.1 Domain

- `AlertType` (`alert_type_id SMALLINT PK`): `code` (unique), `name`,
  `severity`, `channel` (`DASHBOARD|EMAIL|PUSH`, default via migration is
  `IN_APP` — see §6 open note), audit columns, `row_version`.
- `Alert` (`alert_id BIGINT PK`): `academic_actor_id` (cross-context, no FK),
  `alert_type_id` (FK to `alert_type`), `raised_at`, `resolved_at` nullable,
  audit columns, `row_version`.
- Validation: `Alert` requires `academic_actor_id` and `alert_type_id` non-zero.
  `AlertType` requires `code`, `name`, `severity`; `channel`, if present, must
  be one of `DASHBOARD`/`EMAIL`/`PUSH`.

### 2.2 HTTP endpoints

All registered twice: under `/api/v1/...` and a bare alias without the
`/api/v1` prefix (kept for backward compatibility — preserve both).

**Alerts** (`/api/v1/alerts`, alias `/alerts`):
- `POST ""` — create. Body: `{academic_actor_id, alert_type_id}`. Returns
  `201 {alert_id}`.
- `GET ""` — list. Query: `actorId`, `typeId`, `resolved` (bool) or `status`
  (`resolved|open|pending`, alias for `resolved`), `limit`, `offset`. Filters
  the result to the caller's actor scope (see §2.4) before returning.
- `GET "/:id"` — get one. 403 if outside caller's scope.
- `PATCH "/:id/resolve"` — resolve. 403 if outside caller's scope; checks
  scope against the *current* alert before resolving.
- `DELETE "/:id"` — delete. `204` on success.
- Domain error mapping: `ErrValidation`→400, `ErrNotFound`→404,
  `ErrDuplicate`→409, else 500.

**Alert types** (`/api/v1/alert-types`, alias `/alert-types`):
- `POST ""`, `GET ""` (query `limit` default 50, `offset` default 0),
  `GET "/:id"`, `PUT "/:id"`, `DELETE "/:id"` (204).

**Email** (`/api/v1/emails`, internal-only, no alias, no gateway route):
- `POST ""` — body `{to, template, data}`. `template` must be the single
  whitelisted value `"verification_code"`. Validates `to` as an email
  address. Optional shared-secret guard via `X-Internal-Token` header,
  checked against `EMAIL_INTERNAL_TOKEN` env var (open if unset). Renders
  via template, sends via SMTP sender. Responses: `202 {status: "accepted"}`
  on success; `202 {status:"skipped", reason:"smtp_not_configured"}` when
  SMTP isn't configured (never fail the caller for a dev-mode gap); `502
  {error:"DELIVERY_FAILED"}` on real delivery failure; `400
  {error:"VALIDATION_ERROR"}` for bad input/unsupported template; `403` for
  bad/missing internal token.

**Health / quality / meta** (no auth, in `isPublicPath`):
- `GET /health`, `GET /api/v1/health` — liveness payload
  `{status, service, version, uptimeSeconds, timestamp}`.
- `GET /health/quality`, `GET /api/v1/quality/report` — ISO 9001 quality
  snapshot (see §2.5).
- `NoRoute` → `404 {error:"NotFound", message, timestamp}`.
- `NoMethod` → `405 {error:"MethodNotAllowed", message, timestamp}`.
- Response headers on every request: `X-Request-ID` (echoed or generated),
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `X-Process-Time-Ms`.

### 2.3 Auth middleware (applies to everything except `isPublicPath`)

Same contract as the Java services' `AuthTokenFilter`:
- `Authorization: Bearer <session-uuid>` required; token must match a UUID
  shape. Missing/malformed → 401.
- Session validated against `GET {IDENTITY_URL}/api/v1/sessions/:token`;
  must be `sessionStatus == "Active"` with a `userId`. Positive results
  cached 10s per token (`authCacheTTL`), capped at 5000 entries (cache
  cleared wholesale when exceeded). Failures never cached (fail-secure).
  Unreachable identity → 503 `"Cannot verify session"`.
- Permission requirement resolved by `NotificationPermission(method, path)`:
  - `/api/v1/quality*` → `configuration:manage`
  - `GET` → `notification.alert:read`
  - `PATCH .../resolve` → `attendance.record:write`
  - everything else → `configuration:manage`
  - Evaluated against `GET {AUTHORIZATION_URL}/api/v1/auth/evaluate?userId=&permission=`;
    positive results cached 10s per `(token,userId,permission)`. Non-200 or
    `allowed:false` → 403.
- `AUTH_ENABLED=false` env var disables the whole middleware (dev only).
- `OPTIONS` requests always pass through.

### 2.4 Actor scope (IDOR control on alert reads)

Resolved only for alert paths (`/api/v1/alerts*`, `/alerts*`), cached 60s per
user ID:
- Fetch caller roles from `GET {AUTHORIZATION_URL}/api/v1/users/:userId/roles`.
- `Super Administrador` → scope is `null` (sees everything).
- Resolve caller's `academic_actor` records via
  `GET {ACADEMIC_URL}/api/v1/academic-actors?personId=...`, matching by
  `personId` (own actor IDs).
- `Administrador` (school admin) → page through
  `GET {ACADEMIC_URL}/api/v1/academic-actors?limit=&offset=` (page size
  100) to find the caller's own school(s), then scope = every actor in
  those schools. If the caller has no school (shouldn't happen), fail
  secure to their own actors only — never widen to "see all".
- Everyone else → own actor IDs, plus for each own actor: active cohort
  enrollments of schedule blocks where that actor is the instructor
  (`GET {SCHEDULING_URL}/api/v1/schedule-blocks?instructorActorId=`, then
  `GET {ACADEMIC_URL}/api/v1/cohorts/:id/enrollments`, keep
  `enrollmentStatus == "Active"`).
- Any inter-service call that errors propagates as a 503 rather than
  silently widening scope. One retry (250ms pause) on transport failure or
  5xx; 4xx is final, no retry.
- `GET /:id` and `PATCH /:id/resolve` check scope against the loaded
  alert's `academic_actor_id`; `GET ""` (list) filters the result set.

### 2.5 Quality audit middleware

Runs on every request (registered globally): classifies operation
(`CREATE/READ/UPDATE/DELETE/HEALTH/METRICS/OTHER`), records in-memory
counters (totals, success/error, 4xx/5xx, per-CRUD-verb counts, total
duration), logs one structured JSON line per request
(`QUALITY_AUDIT` / `QUALITY_AUDIT_ERROR`) including an ISO 9001 clause
tag (`classifyISOClause`). `GET /health/quality` and
`GET /api/v1/quality/report` return the snapshot with computed
`error_rate_pct`, `avg_response_time_ms`, `availability_pct` (target
99.5%), and a `clause_*: "ACTIVE"` map. This must require the
`configuration:manage` permission like the Go version (via the auth
middleware's permission rule), not be fully public.

### 2.6 Kafka: justification-reviewed consumer

- Topic `attendance.justification.events`, consumer group
  `notification-service`. Only runs when `KAFKA_BROKERS` is set and the DB
  pool is up.
- Consumes `JustificationReviewed` events
  (`{eventType, justificationId, academicActorId, status, reviewedAt}`).
  Ignores any `eventType` other than `"JustificationReviewed"` (the topic
  also carries `JustificationSubmitted`, not ours — treat as a no-op success,
  not an error).
- Maps `status` → alert type code: `Approved`→`JUSTIFICATION_APPROVED`,
  `Rejected`→`JUSTIFICATION_REJECTED`. Unknown status, zero actor ID, or
  zero `reviewedAt` → invalid event: log and skip (commit offset, never
  retry — these can never succeed).
- Idempotent on natural key (actor, alert type, `raised_at == reviewedAt`
  truncated to microsecond precision): checks existing alerts before
  insert so at-least-once redelivery doesn't duplicate.
- Any other error (DB down, missing seed type) is retried with exponential
  backoff (1s, 2s, 4s, 8s, 16s, then capped at 30s) and the offset is **not**
  committed until it succeeds — this must not advance past a message it
  couldn't process.
- Equivalent of `WatchPartitionChanges: true` in `kafkajs` (the topic may be
  created by Attendance's first publish after this service starts).

### 2.7 Alert creation → external delivery (webhook)

When an alert is created (`POST /api/v1/alerts` or the justification-result
use case) and its `alert_type.channel` is `EMAIL` or `PUSH` (not
`DASHBOARD`, not empty), dispatch a webhook **fire-and-forget** (never
blocks or fails the HTTP/Kafka response):
- `POST {WEBHOOK_URL}` with JSON payload `{alert_id, academic_actor_id,
  alert_type_id, alert_type_code, severity, channel, raised_at}`.
- `X-Webhook-Signature: HMAC-SHA256(secret, body)` header when
  `WEBHOOK_SECRET` is set.
- Own 10s timeout independent of the triggering request's context
  (detached — the request may already have returned).
- Treat "not configured" (`WEBHOOK_URL` empty) as skipped, not an error;
  log failures otherwise, never surface them to the caller.

### 2.8 Email channel (SMTP)

- `net/smtp`-equivalent in Node: STARTTLS on the configured port unless
  port 465 (implicit TLS), `PLAIN` auth when `SMTP_USERNAME` set,
  multipart/alternative MIME (`text/plain` + `text/html`) when an HTML body
  exists, else plain text. Subject RFC 2047-encoded for non-ASCII. Own
  timeout bounding dial + full send.
- Template whitelist: only `verification_code` (reject anything else as
  `400 VALIDATION_ERROR` before even touching SMTP — this is what keeps the
  internal endpoint from being an open relay).
- Template rendering: two Go template files per template
  (`verification_code.html.tmpl`, `verification_code.txt.tmpl`) — port
  their content/placeholders ({{.code}}, {{.appname}}, {{.minutes}}) to a TS
  templating approach (simple string substitution is enough — no need for a
  templating library). Keys matched case-insensitively. Reject any data
  value containing `{{` or `}}` (defense against template injection).
  Defaults: `appname` → "FaceAttend EDU", `minutes` → "10" when absent/blank.
  Fixed subject: `"Restablece tu contraseña - FaceAttend EDU"`.
- `ErrNotConfigured` equivalent when `SMTP_HOST` is empty — handled by the
  caller as "skipped", not a failure.

### 2.9 Config / wiring

Env vars to preserve (confirmed against `.env.example`): `DATABASE_URL`,
`PORT` (code default 8088, `.env.example` shows 8090 — keep code's 8088
default), `IDENTITY_URL`, `AUTHORIZATION_URL`, `ACADEMIC_URL`,
`SCHEDULING_URL`, `AUTH_ENABLED`, `KAFKA_BROKERS`, `WEBHOOK_URL`,
`WEBHOOK_SECRET`, `WEBHOOK_TIMEOUT_SECONDS`, `EMAIL_INTERNAL_TOKEN`,
`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`,
`SMTP_STARTTLS`, `SMTP_TIMEOUT_SECONDS`.

If `DATABASE_URL` is unreachable, the Go service logs a warning and keeps
running with handlers that 500 on DB ops. The TS sibling services
(`03-ms-academic`) instead treat an unreachable DB as a **fatal boot
error**. Follow the `03-ms-academic` convention (fail fast) rather than the
Go service's soft-degrade — this is a deliberate improvement, not a
behavior to replicate, since compose already restarts the container on
crash and silent 500s are worse than a clear boot failure.

## 3. Target structure (mirrors `03-ms-academic`)

```
back-end/08-ms-notification/
  src/
    domain/entities/
      Alert.ts
      AlertType.ts
    application/use-cases/
      CreateAlertUseCase.ts
      ListAlertsUseCase.ts
      ResolveAlertUseCase.ts
      DeleteAlertUseCase.ts
      CreateAlertTypeUseCase.ts
      ListAlertTypesUseCase.ts
      UpdateAlertTypeUseCase.ts
      DeleteAlertTypeUseCase.ts
      NotifyJustificationResultUseCase.ts
    infrastructure/
      db/database.ts
      http/
        routes.ts
        authGuard.ts          # session+permission middleware (§2.3)
        actorScope.ts         # IDOR scope resolution (§2.4)
        permissions.ts        # NotificationPermission mapping
        qualityMiddleware.ts  # §2.5
        emailRoutes.ts        # or folded into routes.ts, matches existing pattern
      persistence/
        schema.ts             # Drizzle schema: alert_type, alert
        errors.ts
        audit.fields.ts
        alert.repository.ts
        alert-type.repository.ts
      messaging/
        event.publisher.ts    # if Notification also publishes events; else omit
        justification.consumer.ts  # Kafka consumer (§2.6)
      webhook/
        notifier.ts           # §2.7
      email/
        sender.ts             # §2.8 SMTP transport
        render.ts             # template rendering
        templates/
          verification-code.html.ts (or .txt files read at startup)
          verification-code.txt.ts
    main.ts
  drizzle.config.ts
  package.json
  tsconfig.json
  jest.config.js
  Dockerfile
  .env.example
  SERVICE.md
  STACK.md
  README.md
```

Drizzle schema encodes exactly the columns in
`migrations/000001_init.up.sql` (§6 notes the one default-value
discrepancy to resolve). `drizzle-kit` generates the migration SQL from
the schema — the existing hand-written `migrations/*.sql` are deleted once
the Drizzle-generated equivalent is in place and applied.

## 4. What gets deleted

Everything Go-specific in `08-ms-notification`:
`cmd/`, `internal/`, `go.mod`, `go.sum`, `Makefile`, the Go `Dockerfile`,
`migrations/*.sql`, and `README.md`/`STACK.md` (replaced by TS versions).
`DATA_MODEL.md` stays (schema is DB-level, language-agnostic) unless it
contains Go-specific examples, in which case update them.

## 5. Documentation updates

- `back-end/SERVICES.md`: stack table row for service 08 (Go/Gin→
  TS/Fastify), §2.3 "Politica de Lenguajes" table (move Notification out of
  the Go row; Go row becomes empty/removed, TypeScript row's service count
  goes from 2 to 3), §3.8 description line.
- `08-ms-notification/SERVICE.md`: §3 "Stack Tecnologico" rewritten for
  TS/Fastify/Drizzle, dependency list updated to the Node equivalents
  (`kafkajs` instead of `segmentio/kafka-go`, `pino` instead of `zap`,
  `pg`/`drizzle-orm` instead of `pgx`, Node's `nodemailer` or built-in
  `net`/`tls` for SMTP — decide in the implementation plan, not the spec).
- `08-ms-notification/STACK.md`, `README.md`: same update.

## 6. Open items for the implementation plan (not blocking spec approval)

- `alert_type.channel` default: the migration sets `DEFAULT 'IN_APP'`, but
  the Go validator's whitelist is `DASHBOARD|EMAIL|PUSH` (no `IN_APP`).
  This is a pre-existing inconsistency in the Go code, not something this
  rewrite should silently "fix" without flagging — the plan should decide
  whether to carry the `IN_APP` default forward (safest, preserves current
  DB behavior) or align it to `DASHBOARD` (this is where a bug would
  surface if assumed fixed without checking).
- Exact Node package choices (SMTP library vs. hand-rolled, Kafka client,
  logger) are implementation details for the plan, constrained only by
  "match `03-ms-academic`'s dependency choices where an equivalent already
  exists there" (fastify, drizzle-orm, pg, kafkajs, pino, zod).
- Whether `event.publisher.ts` is needed at all (does Notification publish
  any domain events today? Go code shows none — likely omit this file).

## 7. Testing

Jest, mirroring the Go test coverage (`*_test.go` files): use-case unit
tests, `authGuard`/`actorScope` tests (including the fail-secure paths:
no-school admin, transient-then-success retry, 4xx-no-retry), webhook
notifier tests (configured/unconfigured, signature), email render tests
(template injection rejection, fallback values), Kafka consumer tests
(invalid event skip, idempotent redelivery, backoff/no-commit-on-error).
Run against the local docker-compose stack per the project's local-env
workflow before opening a PR.

## 8. Branch / commit workflow

Checkout `develop`, create a new branch for this work, follow the repo's
one-line Conventional Commits convention (sole authorship, no AI
attribution trailers per user's standing instruction), squash-merge
subject line at the end.
