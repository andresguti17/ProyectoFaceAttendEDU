# Authorization Service — `02-ms-authorization`

## 1. Responsabilidad

Control de acceso basado en roles (RBAC). Gestionar roles, permisos y asignaciones usuario-rol. Servicio complementario a Identity que determina QUEN puede hacer QUE.

## 2. Tablas

| Tabla | Descripcion | PK |
|-------|-------------|-----|
| `role` | Catalogo de roles del sistema | `role_id` (INT) |
| `permission` | Catalogo de permisos atomicos | `permission_id` (INT) |
| `role_permission` | Asignacion N:N roles <-> permisos | `(role_id, permission_id)` |
| `user_role` | Asignacion N:N usuarios <-> roles | `(user_id, role_id)` |

**Cross-context:** `user_role.user_id` referencia a `Identity.app_user.user_id` (sin FK real)

## 3. Stack Tecnologico

### 3.1 Lenguaje y Framework

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Lenguaje | **Java 21** | Consistencia con los demas servicios nucleares (Identity, Scheduling, Attendance) |
| Framework | **Spring Boot 4.1.1** | Spring Security es el estandar oro para RBAC |
| Arquitectura | **Hexagonal** | Misma estructura que Identity |

### 3.2 Dependencias Principales

```xml
<!-- Core -->
spring-boot-starter-webmvc
spring-boot-starter-security      <!-- RBAC, JWT, autorizacion -->
spring-boot-starter-data-jpa
spring-boot-starter-validation
spring-boot-starter-actuator
spring-boot-starter-kafka
spring-boot-starter-liquibase

<!-- Persistencia -->
postgresql

<!-- API Documentation -->
springdoc-openapi-starter-webmvc-ui

<!-- Utilidades -->
lombok
```

### 3.3 Librerias Recomendadas Adicionales

| Libreria | Uso | Por que |
|----------|-----|---------|
| **Spring Security** | Autenticacion/Autorizacion | JWT, RBAC y sesiones out-of-the-box |
| **Spring Data JPA** | Persistencia | Repositorios tipados, constraints de unicidad |
| **Spring Cache** | Cache de permisos | Redis/Caffeine para evaluacion rapida de RBAC |
| **Liquibase** | Migraciones | Versionado de DDL en cada schema |
| **MapStruct** | Mapeo DTO <-> Entity | Type-safe, compile-time |
| **Lombok** | Boilerplate reduction | Reduce codigo repetitivo |
| **Testcontainers** | Tests de integracion | PostgreSQL real en tests |
| **springdoc-openapi** | Documentacion API | Swagger UI automatico |

### 3.4 Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **Maven** | Build tool |
| **Docker** | Containerizacion |
| **IntelliJ IDEA** | IDE principal |
| **DBeaver** | Cliente PostgreSQL |
| **Postman / Bruno** | Testing REST |

### 3.5 Stack Actual

Authorization esta implementado en **Java 21 + Spring Boot 4.1.1** con arquitectura hexagonal.

#### Justificacion

- **Spring Security**: El estandar para RBAC/JWT — autorizacion de permisos resuelta en el propio token (claims por ADR-008) y en el contexto de seguridad.
- **Spring Data JPA**: Repositorios tipados con constraints de unicidad `(user_id, role_id)` y `(role_id, permission_id)`.
- **Spring Cache + Redis**: Cache de permisos para evaluacion rapida de RBAC en cada request.
- **Kafka**: Eventos de dominio (`RoleCreated`, `UserRoleAssigned`, ...).
- **Testcontainers**: Tests de integracion con PostgreSQL real.

---

## 4. Endpoints

### 4.1 Roles

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/roles` | Crear rol |
| GET | `/api/v1/roles/{id}` | Obtener rol |
| PUT | `/api/v1/roles/{id}` | Actualizar rol |
| DELETE | `/api/v1/roles/{id}` | Eliminar rol |
| GET | `/api/v1/roles` | Listar roles |

### 4.2 Permisos

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/permissions` | Crear permiso |
| GET | `/api/v1/permissions/{id}` | Obtener permiso |
| GET | `/api/v1/permissions` | Listar permisos |

### 4.3 Asignaciones

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/roles/{roleId}/permissions` | Asignar permiso a rol |
| DELETE | `/api/v1/roles/{roleId}/permissions/{permId}` | Remover permiso de rol |
| POST | `/api/v1/users/{userId}/roles` | Asignar rol a usuario |
| DELETE | `/api/v1/users/{userId}/roles/{roleId}` | Remover rol de usuario |
| GET | `/api/v1/users/{userId}/roles` | Roles de un usuario |
| GET | `/api/v1/roles/{roleId}/permissions` | Permisos de un rol |

### 4.4 Evaluacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/auth/evaluate?userId={id}&permission={name}` | Verificar si usuario tiene permiso |

---

## 5. Domain Events

| Evento | Trigger | Consumidores tipicos |
|--------|---------|---------------------|
| `RoleCreated` | Nuevo rol creado | — |
| `RoleUpdated` | Rol modificado | — |
| `UserRoleAssigned` | Rol asignado a usuario | Notification |
| `UserRoleRevoked` | Rol removido de usuario | — |

---

## 6. Patron RBAC

```
User ──N:N──> Role ──N:N──> Permission
                 │
                 ▼
          role_permission
          (assignment_date)
```

### Roles predefinidos (seeds, unificados para Mobile en `004-unify-mobile-roles.yaml` y diferenciados en `007-split-super-admin-role.yaml`)

| Rol | Descripcion |
|-----|-------------|
| Super Administrador | Rol Web: administrador global sin sede (permisos totales; solo el admin bootstrap) |
| Administrador | Rol Mobile: acceso total en su sede (fusiona `SUPER_ADMIN` + `SCHOOL_ADMIN` legados) |
| Instructor | Rol Mobile: docencia y asistencia (antes `INSTRUCTOR`) |
| Aprendiz | Rol Mobile: consulta propia (antes `STUDENT`) |

### Permisos atomicos (seeds)

```
person.create, person.read, person.update, person.delete
school.create, school.read, school.update
enrollment.create, enrollment.read
attendance.read, attendance.update
justification.approve
biometric.update
configuration.manage
```

---

## 7. Configuracion

### application.yml (ejemplo)

```yaml
server:
  port: 8082

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/faceattend_db
    username: postgres
    password: postgres
    hikari:
      schema: authorization
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate.default_schema: authorization
  data:
    redis:
      host: localhost
      port: 6379
  kafka:
    bootstrap-servers: localhost:9092
    group-id: authorization-service

security:
  jwt:
    issuer: faceattend-identity
    audience: faceattend-api
```

---

## 8. Puertos del Servidor

| Puerto | Servicio |
|--------|----------|
| 8082 | REST API |
| 9092 | Kafka (externo) |
| 5432 | PostgreSQL (externo) |
| 6379 | Redis (opcional, cache) |
