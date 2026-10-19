# STACK — 03-ms-academic

> **Stack ADR-005:** `TypeScript + Fastify + Drizzle ORM` · **Guía:** `../../fae-docs/_stacks/node-typescript.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **ADR:** `../../fae-docs/05-architecture/decisions/records/ADR-005-technology-stack.md`
> **Database:** `../database/03-ms-academic-db` (schema `academic`) · **Puerto:** `8083` · **Dominio:** `06-data/domains/03-academic.md`

## Decisión (ADR-005 §3)

**Best option: TypeScript + Fastify + Drizzle (22/25)** — 8 entidades, JOINs complejos para reportes.

| # | Option | Perf | Eco | Learn | Lib | Ops | Total | Notes |
|---|--------|:----:|:---:|:-----:|:---:|:---:|-------|-------|
| **1** | **TS + Fastify + Drizzle** | 4 | 4 | 5 | 4 | 5 | **22** | Drizzle SQL-like, genera SQL eficiente vs TypeORM. |
| 2 | Java + Spring Boot | 4 | 5 | 2 | 5 | 3 | 19 | Hibernate 7 entidades OK, JVM overhead. |
| 3 | Python + FastAPI + SQLAlchemy | 3 | 4 | 4 | 4 | 4 | 19 | SQLAlchemy bueno, GIL limita reports. |
| 4 | TS + NestJS + TypeORM | 3 | 5 | 4 | 4 | 4 | 20 | TypeORM JOINs verbosos/incorrectos. |
| 5 | Go + Gin + sqlx | 5 | 3 | 2 | 3 | 4 | 17 | Más rápido, manual SQL todo. |

**Rationale:** Drizzle type-safety catch schema mismatches compile-time; Fastify speed para reporting read-heavy.

## Estructura hexagonal (node-typescript.md)

```
src/
├── domain/
│   ├── entities/ School, Program, Cohort, Course, AcademicActor, Enrollment
│   ├── value-objects/ AcademicActorType
│   ├── events/ EnrollmentCreated, CourseCreated
│   └── ports/in+out/ ICreateEnrollmentUseCase, IEnrollmentRepository
├── application/use-cases/ CreateEnrollmentUseCase
└── infrastructure/
    ├── http/ controllers + routes (Fastify)
    ├── persistence/ Drizzle schema + repository
    └── messaging/ Kafka publisher
```

## Dependencias (package.json)

Fastify 4, Drizzle ORM, `pg` 8, `zod` 3, `kafkajs`, `pino`, `typescript` 5, `jest` + `testcontainers`.

## Ejecución

```bash
npm install && npm run dev  # 8083
npm test && npm run build
```
