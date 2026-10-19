# STACK — 04-ms-scheduling

> **Stack ADR-005:** `Java 21 + Spring Boot 4.1.1` · **Guía:** `../../fae-docs/_stacks/java-spring.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **ADR:** `../../fae-docs/05-architecture/decisions/records/ADR-005-technology-stack.md`
> **Database:** `../database/04-ms-scheduling-db` (schema `scheduling`) · **Puerto:** `8084` · **Dominio:** `06-data/domains/04-scheduling.md`

## Decisión (ADR-005 §4)

**Best option: Java 21 + Spring Boot 4.1.1 (19/25)** — critical invariant anti-double-booking via unique constraints.

| # | Option | Perf | Eco | Learn | Lib | Ops | Total | Notes |
|---|--------|:----:|:---:|:-----:|:---:|:---:|-------|-------|
| **1** | **Java + Spring Boot** | 4 | 5 | 2 | 5 | 3 | **19** | `@UniqueConstraint` + `DataIntegrityViolationException` clean. |
| 2 | TS + Fastify + Drizzle | 4 | 4 | 5 | 4 | 5 | 22 | Constraints work, exception handling less elegant. |
| 3 | TS + NestJS + TypeORM | 3 | 5 | 4 | 4 | 4 | 20 | TypeORM inefficient. |
| 4 | Python + FastAPI | 3 | 4 | 4 | 4 | 4 | 19 | Different runtime. |
| 5 | Go + Gin | 5 | 3 | 2 | 3 | 4 | 17 | DB-level constraints, not app. |

**Rationale:** ACID transaction atomic schedule_block + class_session; consistency with identity/authorization/attendance.

## Estructura hexagonal (java-spring.md)

```
src/main/java/com/faceattend_edu/scheduling_service/
├── domain/model/ Environment, ScheduleBlock, ClassSession
└── infrastructure/persistence/ JpaEntity with @UniqueConstraint
```

## Dependencias

Spring Boot 4.1.1, `webmvc`, `data-jpa`, `validation`, `liquibase`, `postgresql`, `lombok`.

## Ejecución

```bash
./mvnw spring-boot:run  # 8084
```
