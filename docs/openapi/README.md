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

## Known gap: Node services

academic (03), configuration (07), notification (08) and quality (09) are Fastify
services without `@fastify/swagger`, so there is nothing to generate for them yet.
Their routes are described in fae-docs (`07-api/endpoint-matrix.md`). Adding
`@fastify/swagger` with route schemas is the next step to bring them under this check.
