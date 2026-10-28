# STACK — 08-ms-notification

> **Stack ADR-005:** `TypeScript 5 + Node 20 + Fastify 4` · **Guía:** `../../fae-docs/_stacks/node-typescript.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **ADR:** `../../fae-docs/05-architecture/decisions/records/ADR-005-technology-stack.md`
> **Database:** `../database/08-ms-notification-db` (schema `notification`) · **Puerto:** `8088` · **Dominio:** `06-data/domains/07-notification.md`

## Decisión (ADR-005 §7)

**Implementado: TS + Fastify (22/25)** — lightweight 2 tables, fastest to implement. La opción Go + Gin (17/25) del análisis original fue descartada en la reescritura.

| # | Option | Perf | Eco | Learn | Lib | Ops | Total | Notes |
|---|--------|:----:|:---:|:-----:|:---:|:---:|-------|-------|
| 1 | Go + Gin | 5 | 3 | 2 | 3 | 4 | 17 | 5-10 MB binary, ideal low-complexity. (descartada) |
| **2** | **TS + Fastify** | 4 | 4 | 5 | 4 | 5 | **22** | 20 min coding, fastest to implement. (implementada) |
| 3 | TS + NestJS | 3 | 5 | 4 | 5 | 4 | 21 | Overkill 2 tables. |
| 4 | Python + FastAPI | 3 | 4 | 4 | 4 | 4 | 19 | Different runtime trivial. |
| 5 | Java + Spring Boot | 4 | 5 | 2 | 5 | 3 | 19 | 2 tables don't need Spring. |

**Rationale:** Mismo runtime Node que Academic (03) y Configuration (07), CRUD simple sobre 2 tablas y consumo de eventos Kafka con `kafkajs`.

## Estructura hexagonal

```
src/
├── domain/
│   ├── entities/         Alert.ts, AlertType.ts
│   └── ports/out/        IAlertRepository.ts, IAlertTypeRepository.ts, ICrudRepository.ts
├── infrastructure/
│   ├── http/             routes.ts, authGuard.ts, permissions.ts, actorScope.ts, qualityMiddleware.ts
│   ├── persistence/      postgres/ (alert, alert-type, crud), schema.ts, errors.ts
│   ├── messaging/        justification.consumer.ts (kafkajs)
│   ├── email/            render.ts, sender.ts (nodemailer)
│   ├── webhook/          notifier.ts
│   └── db/               database.ts (pg)
└── main.ts
```

## Dependencias (package.json)

Fastify 5.12, pg 8.11, kafkajs 2.2, nodemailer 10.2, pino 9.14, zod 4.6 (migraciones: Liquibase en `database/`).
Dev: typescript 5.4, jest 29 + ts-jest.

## Ejecución

```bash
npm install
npm run dev     # 8088 (ts-node-dev, src/main.ts)
npm run build   # tsc -> dist/
npm start       # node dist/main.js
npm test        # jest
```
