# Acople Database ↔ Back-end — FaceAttend EDU

> **Fuente canónica de esquema:** ../database/ (8 bounded contexts, 1 BD faceattend_db + 8 schemas, Liquibase)
> **Modelo lógico:** ../../fae-docs/06-data/domains/ (01-identity ... 08-configuration, 07-notification)
> **Arquitectura:** ../../fae-docs/05-architecture/ (hexagonal-architecture.md, overview.md, ADR-005, ADR-007)
> **Guías por stack:** ../../fae-docs/_stacks/ (java-spring.md, node-typescript.md, python-fastapi.md, go.md)

## 1. Mapa de acople (esta carpeta back-end/ ↔ database/)

| # | Back-end (esta carpeta) | Database (../database) | Schema | Tablas / Colecciones (06-data/domains) | Dominio fae-docs | Stack ADR-005/007 | Guía _stacks |
|---|--------------------------|---------------------------|--------|----------------------------------------|------------------|---------------|--------------|
| 01 | 01-ms-identity/ | 01-ms-identity-db/ | identity | person, app_user, user_session, password_policy | 06-data/domains/01-identity.md | Java 21 + Spring Boot 4.1.1 | java-spring.md |
| 02 | 02-ms-authorization/ | 02-ms-authorization-db/ | authorization | role, permission, role_permission, user_role | 06-data/domains/02-authorization.md | Java 21 + Spring Boot 4.1.1 | java-spring.md |
| 03 | 03-ms-academic/ | 03-ms-academic-db/ | academic | school, program, academic_period, cohort, course, academic_actor_type, academic_actor, enrollment | 06-data/domains/03-academic.md | TypeScript + Fastify + Drizzle | node-typescript.md |
| 04 | 04-ms-scheduling/ | 04-ms-scheduling-db/ | scheduling | environment, schedule_block, class_session | 06-data/domains/04-scheduling.md | Java 21 + Spring Boot 4.1.1 | java-spring.md |
| 05 | 05-ms-attendance/ | 05-ms-attendance-db/ | attendance | attendance_record, justification_type, justification, supporting_document (+ attendance_report) | 06-data/domains/05-attendance.md | Java 21 + Spring Boot 4.1.1 | java-spring.md |
| 06 | 06-ms-biometric/ | 06-ms-biometric-db/ | biometric (vacío) + MongoDB | SQL: (schema vacío) · NoSQL: facial_embeddings, fingerprint_embeddings · caso en configuration.biometric_update_case | 06-data/domains/06-biometric.md | Python 3.12 + FastAPI | python-fastapi.md |
| 07 | 07-ms-configuration/ | 07-ms-configuration-db/ | configuration | academic_configuration, security_configuration, biometric_update_case | 06-data/domains/08-configuration.md | TypeScript + Fastify | node-typescript.md |
| 08 | 08-ms-notification/ | 08-ms-notification-db/ | notification | alert_type, alert | 06-data/domains/07-notification.md | Go 1.22 + Gin | go.md |
| 99 | 99-api-gateway/ | (sin DB — infra) | — (Redis 7 cache/rate-limit) | — (config declarativa kong/kong.yml) | ADR-007-api-gateway.md | Kong OSS 3.6 DB-less + Redis | — (infra) |

> 07-ms-audit eliminado por solicitud. Numeración reacomodada: 07-configuration y 08-notification ahora alinean 1:1 con DB 07/08 y dominios 09/07. Gateway 99 es infra (no bounded context).

## 2. Por qué 06-data/domains es la referencia (no 09-microservices)
09-microservices/services/ incluye 06-iot-service inexistente en FULL y desactualizado. La fuente canónica es 06-data/domains/*.md 1:1 con database/NN-ms-*-db/01-ddl/03-tables/*.yaml y MODELO.md/ESTRUCTURA.md.

## 3. Stack por servicio (ADR-005 + ADR-007)
Fuente: 05-architecture/decisions/records/ADR-005-technology-stack.md (polyglot modular monolith) + ADR-007-api-gateway.md (Kong).
- Java Spring Boot (01,02,04,05): Hibernate/JPA + Spring Security + @Transactional/@UniqueConstraint para core transaccional.
- TypeScript Fastify+Drizzle (03 academic): JOINs 7 tablas.
- Python FastAPI (06 biometric): OpenCV Python-first, pymongo vector.
- TypeScript Fastify (07 configuration): CRUD trivial 3 tablas.
- Go Gin (08 notification): binario 5-10 MB para 2 tablas.
- Kong OSS DB-less + Redis (99 gateway): plugins JWT/rate-limit/CORS, kong.yml declarativo, extraction-ready (ADR-002).

## 4. Arquitectura hexagonal (05-architecture)
Todos los 01-08 siguen hexagonal-architecture.md: domain → application → infrastructure/adapters. Regla: infrastructure → application → domain. Cada guía _stacks traduce la carpeta concreta.

## 5. Estructura Liquibase canónica
NN-ms-{domain}-db/
  changelog/changelog-master.yaml
  01-ddl/{00-extensions,01-schemas,02-types,03-tables,04-views,...09-indexes}
  02-dml/{seeds}  03-dcl/{roles,grants}  04-tcl/{fn_audit_timestamps}
Orden: 01-ddl → 02-dml → 03-dcl → 04-tcl. Ver ../database/ESTRUCTURA.md. Ejecución: cd ../database && docker compose up -d

## 6. Documentación por servicio (esta carpeta)
Cada servicio 01-06,07,08 + 99 expone junto a SERVICE.md: DATA_MODEL.md (canónico 06-data + DDL) y STACK.md (ADR + _stacks). Ver carpetas individuales. Audit excluido.
