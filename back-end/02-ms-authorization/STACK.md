# STACK — 02-ms-authorization

> **Stack ADR-005:** `Java 21 + Spring Boot 4.1.1` · **Guía:** `../../fae-docs/_stacks/java-spring.md`
> **Arquitectura:** `../../fae-docs/05-architecture/hexagonal-architecture.md` · **ADR:** `../../fae-docs/05-architecture/decisions/records/ADR-005-technology-stack.md`
> **Database:** `../database/02-ms-authorization-db` (schema `authorization`) · **Puerto:** `8082` · **Dominio:** `06-data/domains/02-authorization.md`

## Decisión (ADR-005 §2)

**Best option: Java 21 + Spring Boot 4.1.1 (19/25)** — RBAC read-heavy, permission checks embedded in JWT claims per ADR-008.

| # | Option | Perf | Eco | Learn | Lib | Ops | Total | Notes |
|---|--------|:----:|:---:|:-----:|:---:|:---:|-------|-------|
| **1** | **Java + Spring Boot** | 4 | 5 | 2 | 5 | 3 | **19** | Spring Security gold standard. Consistency with identity. |
| 2 | TS + Fastify | 4 | 4 | 5 | 4 | 5 | 22 | DB query cached Redis, fast but not needed. |
| 3 | TS + NestJS | 3 | 5 | 4 | 5 | 4 | 21 | Guards = RBAC but 10 lines not 100. |
| 4 | Python + FastAPI | 3 | 4 | 4 | 4 | 4 | 19 | casbin binding, different runtime. |
| 5 | Go + Gin | 5 | 3 | 2 | 3 | 4 | 17 | Fastest check, overkill cache solves it. |

**Rationale:** Real optimization is JWT claims (ADR-008), not language speed. Java chosen for consistency and Spring Security RBAC patterns, TTL cache 5m.

## Estructura hexagonal (java-spring.md)

```
src/main/java/com/faceattend_edu/authorization_service/
├── domain/
│   ├── model/ Role, Permission, RolePermission, UserRole
│   └── port/in+out/
├── application/usecase/ AssignRole, CheckPermission
└── infrastructure/
    ├── web/ RoleController, PermissionController
    ├── persistence/ RoleJpaEntity, PermissionJpaEntity, Adapter
    └── config/ SecurityConfig
```

## Dependencias (pom.xml)

Spring Boot 4.1.1, `webmvc`, `data-jpa`, `security`, `validation`, `liquibase`, `postgresql`, `lombok`, `springdoc`, `kafka`.

## Ejecución

```bash
cd ../database && docker compose up -d
./mvnw spring-boot:run  # 8082
```
