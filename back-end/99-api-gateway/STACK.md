# STACK — 99-api-gateway

> **Stack ADR-005 §10 + ADR-007:** `Kong OSS 3.6 DB-less + Redis 7` · **Puerto:** `8000 proxy / 8001 admin`
> **ADR:** `../../fae-docs/05-architecture/decisions/records/ADR-007-api-gateway.md` + `ADR-005-technology-stack.md`
> **Infra:** No hexagonal — Kong declarative `kong/kong.yml` + `docker-compose.yml`

## Decisión (ADR-007 + ADR-005 §10)

**Best option: Kong OSS 3.6 DB-less (22/25)**

| # | Option | Perf | Eco | Learn | Lib | Ops | Total | Notes |
|---|--------|:----:|:---:|:-----:|:---:|:---:|-------|-------|
| **1** | **Kong OSS** | 5 | 5 | 3 | 5 | 4 | **22** | Mature plugin JWT/rate-limit/CORS, DB-less, extraction-ready. |
| 2 | Traefik | 4 | 4 | 3 | 4 | 5 | 20 | Modern auto-discovery, less plugins. |
| 3 | NGINX + Lua | 5 | 4 | 2 | 3 | 3 | 17 | Fastest but Lua pain. |
| 4 | Caddy | 4 | 3 | 3 | 3 | 5 | 18 | Auto-HTTPS less plugins. |
| 5 | Node Fastify custom | 3 | 4 | 5 | 4 | 4 | 20 | Reinvent rate-limit/JWT wasteful. |

**Rationale:** Battle-tested plugin ecosystem, declarative `kong.yml` versioned, DB-less reduces ops, Strangler Fig extraction only adds upstream targets.

## Estructura (infra)

```
99-api-gateway/
├── kong/kong.yml          # services/routes/plugins DB-less
├── docker-compose.yml     # kong:3.6 solo (redis compartido, definido en back-end/)
└── SERVICE.md/STACK.md
```

## Plugins

`jwt` (RS256 identity), `rate-limiting` (60-200/min + 300 global), `cors`, `request-transformer`.

## Ejecución

Requiere el stack `FULL/` ya levantado (crea las redes externas
`faceattend-edge` y `faceattend-app`); este archivo solo reinicia Kong.

```bash
docker compose up -d && curl http://localhost:8001/ && curl http://localhost:8000/api/v1/persons
```
