# STACK — 07-ms-configuration

> **Stack ADR-005:** `TypeScript + Fastify` · **Guía:** `../../fae-docs/_stacks/node-typescript.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **ADR:** `../../fae-docs/05-architecture/decisions/records/ADR-005-technology-stack.md`
> **Database:** `../database/07-ms-configuration-db` (schema `configuration`) · **Puerto:** `8087` · **Dominio:** `06-data/domains/08-configuration.md`

## Decisión (ADR-005 §9)

**Best option: TypeScript + Fastify (22/25)** — trivial CRUD 3 tables.

| # | Option | Perf | Eco | Learn | Lib | Ops | Total | Notes |
|---|--------|:----:|:---:|:-----:|:---:|:---:|-------|-------|
| **1** | **TS + Fastify** | 4 | 4 | 5 | 4 | 5 | **22** | 20 min coding, minimal deps. |
| 2 | TS + NestJS | 3 | 5 | 4 | 5 | 4 | 21 | Overkill for 3 tables. |
| 3 | Python + FastAPI | 3 | 4 | 4 | 4 | 4 | 19 | Different runtime simplest. |
| 4 | Go + Gin | 5 | 3 | 2 | 3 | 4 | 17 | Fastest but 3 tables. |
| 5 | Express | 3 | 4 | 5 | 3 | 5 | 20 | No OpenAPI gen. |

**Rationale:** No domain logic, 3 tables CRUD, Fastify lightest with good perf. NestJS decorators not worth overhead.

## Estructura hexagonal (node-typescript.md)

```
src/
├── domain/entities/ AcademicConfiguration, SecurityConfiguration, BiometricUpdateCase
└── infrastructure/persistence/ pg table
```

## Dependencias

Fastify 4, `pg` 8, `zod`, `pino`, `typescript` 5.

## Ejecución

```bash
npm install && npm run dev  # 8087
```
