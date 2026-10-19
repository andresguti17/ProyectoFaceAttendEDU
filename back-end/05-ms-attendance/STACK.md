# STACK — 05-ms-attendance

> **Stack ADR-005:** `Java 21 + Spring Boot 4.1.1` · **Guía:** `../../fae-docs/_stacks/java-spring.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **ADR:** `../../fae-docs/05-architecture/decisions/records/ADR-005-technology-stack.md`
> **Database:** `../database/05-ms-attendance-db` (schema `attendance`) · **Puerto:** `8085` · **Dominio:** `06-data/domains/05-attendance.md`

## Decisión (ADR-005 §5)

**Best option: Java 21 + Spring Boot 4.1.1 (19/25)** — most critical business path, ACID `@Transactional`.

| # | Option | Perf | Eco | Learn | Lib | Ops | Total | Notes |
|---|--------|:----:|:---:|:-----:|:---:|:---:|-------|-------|
| **1** | **Java + Spring Boot** | 4 | 5 | 2 | 5 | 3 | **19** | `@Transactional` banking-grade, extraction-ready. |
| 2 | TS + Fastify | 4 | 4 | 5 | 4 | 5 | 22 | Raw speed higher, structure needed. |
| 3 | TS + NestJS | 3 | 5 | 4 | 5 | 4 | 21 | Microservice transport but Java already. |
| 4 | Python + FastAPI | 3 | 4 | 4 | 4 | 4 | 19 | GIL bottleneck concurrent registrations. |
| 5 | Go + Gin | 5 | 3 | 2 | 3 | 4 | 17 | I/O-bound, Go adds no value. |

**Rationale:** ACID is DB-level but Spring transaction management most mature; consistency with 01,02,04.

## Estructura hexagonal

```
src/main/java/com/faceattend_edu/attendance_service/
├── domain/model/ AttendanceRecord, Justification
└── application/usecase/ RecordAttendanceUseCase @Transactional
```

## Dependencias

Spring Boot 4.1.1, `webmvc`, `data-jpa`, `validation`, `liquibase`, `postgresql`, `kafka`, `lombok`.

## Ejecución

```bash
./mvnw spring-boot:run  # 8085
```
