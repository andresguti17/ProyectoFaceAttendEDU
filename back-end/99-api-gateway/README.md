# 99-api-gateway — Kong OSS

> **Puerto:** 8000 proxy / 8001 admin (solo dentro del contenedor) — Stack ADR-005/007: Kong OSS DB-less + Redis
> **Fuente:** ../../fae-docs/05-architecture/decisions/records/ADR-007-api-gateway.md + ADR-005

## Responsabilidad
Edge: routing, session token validation, rate limiting, CORS, TLS. Enruta a modular monolith 8081-8089 interno, extraction-ready.

## Estructura
99-api-gateway/
  kong/kong.yml
  docker-compose.yml
  SERVICE.md / STACK.md / DATA_MODEL.md

## Run
Requiere el stack FULL/ ya creado (redes `faceattend-edge` y `faceattend-app`).
docker compose up -d kong-gateway; curl http://localhost:8000/api/v1/persons; docker run --rm --network container:faceattend-kong curlimages/curl -s localhost:8001/
