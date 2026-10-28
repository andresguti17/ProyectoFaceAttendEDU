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

## Límite general de peticiones

El límite por IP de todo el API sale de `KONG_RATE_LIMIT_PER_MINUTE` (3000/min por defecto, contadores en Redis). Se valida como entero positivo al arrancar: si no lo es, Kong no arranca. Login y recuperación de cuenta tienen su propio límite, más estricto, en `kong.yml`; Kong solo ejecuta la instancia más específica de un plugin (ruta > servicio > global), así que esas rutas no cuentan contra el general. Un colegio comparte una IP pública: antes de bajar el valor, comprobar que un grupo completo puede cargar la app a la vez.
