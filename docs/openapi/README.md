# OpenAPI contracts

Generated from the code, never edited by hand. CI regenerates them on every pull
request and fails if the result differs from what is committed here, so these files
always describe the code in the same commit.

| File | Service | Source |
|---|---|---|
| `01-ms-identity.json` | identity | springdoc (`/v3/api-docs`) |
| `02-ms-authorization.json` | authorization | springdoc |
| `04-ms-scheduling.json` | scheduling | springdoc |
| `05-ms-attendance.json` | attendance | springdoc |
| `06-ms-biometric.json` | biometric | FastAPI `app.openapi()` |

Keys are sorted and `servers` is removed, so a file only changes when an endpoint,
a parameter or a DTO changes.

## Regenerating after an API change

```bash
# Java services: needs docker, JDK 21 and Maven (boots each service on a throwaway Postgres)
tools/openapi/generate.sh

# Biometric: from its folder, with its dependencies installed
cd back-end/06-ms-biometric && poetry run python ../../tools/openapi/biometric.py
```

Commit the changed JSON together with the code change.

## Known gap: Node services (no generated contract)

Four of the nine services have no file here and are not covered by the CI drift check:

| Service | Framework | Generated contract |
|---|---|---|
| `03-ms-academic` | Fastify 4 + TypeScript | none |
| `07-ms-configuration` | Fastify 4 + TypeScript | none |
| `08-ms-notification` | Fastify 4 + TypeScript | none |
| `09-ms-quality` | Fastify 4 + TypeScript | none |

Why there is nothing to generate:

- No OpenAPI generator is installed. `@fastify/swagger` is not a dependency of any
  package in this repository.
- The routes declare no Fastify `schema`. Request bodies are validated inside each
  handler with zod (`safeParse`), so even with `@fastify/swagger` installed the
  generated document would list paths without parameters, bodies or responses.

Until that changes, the source of truth for these routes is the code
(`back-end/<service>/src/infrastructure/http/`) and the endpoint matrix in fae-docs
(`07-api/endpoint-matrix.md`), which is maintained by hand.

Closing the gap takes two steps per service: add `@fastify/swagger` and give each
route a JSON schema (for example generated from the existing zod schemas). Then add
the service to `tools/openapi/` and to the CI drift check like the others.
