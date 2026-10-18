# API Gateway — 99-api-gateway (Kong OSS)

## 1. Responsabilidad
Entrada unica web/movil/API. Routing, session token validation against identity 8081, rate-limiting, CORS, TLS. Enruta a 9 servicios internos (8081-8089) del modular monolith (ADR-002). Extraction Strangler Fig sin reemplazo.

## 2. Stack (ADR-007 + ADR-005 10)
Kong OSS 3.6 DB-less + Redis 7. Puerto 8000/8001. Ver ADR-007 para alternativas descartadas (NGINX+Lua, Traefik, custom Node).

## 3. Rutas (kong/kong.yml)
| Prefijo | Upstream |
|---------|----------|
| /api/v1/persons, /users, /auth, /sessions | identity 8081 |
| /api/v1/roles, /permissions | authorization 8082 |
| /api/v1/schools, /programs, /cohorts, /courses | academic 8083 |
| /api/v1/environments, /schedule-blocks, /class-sessions | scheduling 8084 |
| /api/v1/attendance-records, /justifications | attendance 8085 |
| /api/v1/biometric | biometric 8086 |
| /api/v1/academic-configurations, /security-configurations, /biometric-update-cases | configuration 8087 |
| /api/v1/alert-types, /alerts | notification 8088 |

## 4. Plugins
jwt, rate-limiting (60-200/min por servicio, 300 global), cors, request-transformer.

## 5. Config
_format_version 3.0 DB-less. Ver kong/kong.yml:1

## 6. Ejecucion
cd 99-api-gateway && docker compose up -d

## 7. Referencias
ADR-007, ADR-005 10, overview 05-architecture
