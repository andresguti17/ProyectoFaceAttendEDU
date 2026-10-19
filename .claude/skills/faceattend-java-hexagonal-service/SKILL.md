---
name: faceattend-java-hexagonal-service
description: Use when adding or changing a feature inside one of the Java/Spring Boot microservices (01-ms-identity, 02-ms-authorization, 04-ms-scheduling, 05-ms-attendance) — new endpoint, use case, repository, or Liquibase-backed entity.
---

# Microservicios Java hexagonales (identity/authorization/scheduling/attendance)

## Overview
4 de los 9 microservicios son Java 21 + Spring Boot 4.1.1 con arquitectura hexagonal: `01-ms-identity` (8081), `02-ms-authorization` (8082), `04-ms-scheduling` (8084), `05-ms-attendance` (8085).

## Cuándo usar
Vas a añadir un endpoint, caso de uso, entidad JPA o repositorio en cualquiera de estos 4 servicios.

## Convenciones verificadas
- Build: Maven. `pom.xml` confirma `spring-boot-starter-webmvc/-data-jpa/-security/-liquibase/-kafka/-data-redis`, `springdoc-openapi` 3.1.0, `lombok`, driver `postgresql`.
- **La convención de carpetas NO es idéntica entre servicios** — verifícala en el servicio concreto antes de copiar la estructura de otro:
  - `01-ms-identity`: `domain/model` → `application/usecase` → `adapter/in/web/controller` / `adapter/out/persistence/repository`.
  - `04-ms-scheduling`: `domain/port/{in,out}` → `application/usecase` → `infrastructure/web/controller` / `infrastructure/persistence/repository`.
  - Regla constante: el dominio nunca importa de `application`/`adapter`/`infrastructure` (hexagonal real, no solo nombre de carpeta).
- Liquibase propio por servicio en `src/main/resources/db/changelog/db.changelog-master.yaml` — **no está confirmado que este árbol sea el que realmente corre**; ver skill `faceattend-liquibase-migration` para la discrepancia con `database/NN-ms-*-db/`.
- Autenticación: cada servicio valida la sesión con su propio guard (`AuthTokenFilter` en Java) — sesión opaca (`sessionId`), **no JWT**. Ver skill `faceattend-api-conventions` antes de tocar cualquier endpoint protegido.
- Testing real observado: JUnit5 + Mockito + H2 en memoria para `@DataJpaTest` (ejemplo en `01-ms-identity`). No se confirmó uso real de Testcontainers en Java.
- Docker: multi-stage `maven:3.9-eclipse-temurin-21-alpine` (build) → `eclipse-temurin:21-jre-alpine` (runtime), usuario no-root, `EXPOSE <puerto>`.

## Guía
1. Ubica el servicio correcto y lee su `SERVICE.md`/`STACK.md`/`DATA_MODEL.md` si existen (confirmados de forma completa en `03-ms-academic`, `06-ms-biometric`, `08-ms-notification`, `99-api-gateway`; `01/02/04/05/07/09` no tienen README/CONTRIBUTING propio verificado más allá de esos documentos de nivel servicio).
2. Para una entidad nueva: define primero el campo en el DBML (`database/faceattend_edu_mr_v4.dbml`, por AGENTS.md), luego el changeset Liquibase (skill aparte), luego la entidad JPA siguiendo el paquete `domain/model` (o su equivalente) **de ese servicio específico**.
3. Nuevo endpoint: controller en el paquete adapter/infra `web/controller` de ese servicio; casos de uso en `application/usecase`; nunca lógica de negocio directamente en el controller.
4. Reglas de negocio de Attendance/Scheduling (ej. una sola `attendance_record` por `(class_session_id, academic_actor_id)`, anti-doble-reserva en `schedule_block`) ya están normadas en AGENTS.md §6 — no las reinventes, solo impleméntalas.

## Restricciones
- No asumas que todos los servicios Java comparten exactamente los mismos nombres de paquete; verifica el servicio concreto.
- No muevas lógica de autenticación/guard fuera del patrón ya existente de ese stack (hay 4 implementaciones distintas documentadas como deuda técnica AT-0xx en `fae-docs/05-architecture/overview.md`; no las unifiques sin que el usuario lo pida).

## Verificación
```bash
cd back-end/<01-ms-identity|02-ms-authorization|04-ms-scheduling|05-ms-attendance>
mvn -B test
```
Es exactamente el step `mvn test` del job `java-services` de `.github/workflows/ci.yml`.

## Dudas/pendientes
- No confirmado si `back-end/<servicio>/src/main/resources/db/changelog/` corre en algún entorno real o es scaffold sin wiring.
- `02-ms-authorization`, `04-ms-scheduling`, `05-ms-attendance` no tienen README/CONTRIBUTING propio verificado más allá de `SERVICE.md`/`STACK.md` — si contradicen esta skill, prevalece lo que encuentres en el código del servicio.
