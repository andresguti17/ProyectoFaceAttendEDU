# Identity Service — `01-ms-identity`

## 1. Responsabilidad

Gestionar la identidad de personas, credenciales de acceso, sesiones de usuario y politicas de contrasena. Es el servicio fundacional que alimenta a todos los demas.

## 2. Tablas

| Tabla | Descripcion | PK |
|-------|-------------|-----|
| `person` | Identidad base: documento, nombre, contacto | `person_id` (UUID) |
| `app_user` | Credenciales de acceso; 1:1 con `person` | `user_id` (UUID) |
| `user_session` | Sesiones activas/cerradas | `session_id` (UUID) |
| `password_policy` | Reglas de complejidad de contrasena | `policy_id` (INT) |

## 3. Stack Tecnologico

### 3.1 Lenguaje y Framework

| Componente | Tecnologia | Justificacion |
|------------|-----------|---------------|
| Lenguaje | **Java 21** | LTS, records, sealed classes, pattern matching |
| Framework | **Spring Boot 4.1.1** | Madurez, ecosistema, compatibilidad con el proyecto |
| Arquitectura | **Hexagonal** | Separacion de concerns, testabilidad |

### 3.2 Dependencias Principales

```xml
<!-- Core -->
spring-boot-starter-webmvc       <!-- REST API -->
spring-boot-starter-data-jpa     <!-- Persistencia JPA -->
spring-boot-starter-security     <!-- Autenticacion/Autorizacion -->
spring-boot-starter-validation   <!-- Bean Validation -->
spring-boot-starter-actuator     <!-- Health checks, metrics -->
spring-boot-starter-kafka        <!-- Domain Events asincronos -->
spring-boot-starter-liquibase    <!-- Migraciones DB -->

<!-- Persistencia -->
postgresql                       <!-- Driver PostgreSQL -->
spring-boot-starter-data-jpa-test <!-- Testcontainers JPA -->

<!-- API Documentation -->
springdoc-openapi-starter-webmvc-ui  <!-- Swagger UI -->

<!-- Utilidades -->
lombok                           <!-- Boilerplate reduction -->
mapstruct                        <!-- Mapeo DTO <-> Domain -->
mapstruct-processor              <!-- Anotacion processor MapStruct -->
```

### 3.3 Librerias Recomendadas Adicionales

| Libreria | Uso | Por que |
|----------|-----|---------|
| **MapStruct** | Mapeo DTO <-> Entity <-> Domain | Type-safe, genera codigo en compile-time, sin reflection |
| **Lombok** | Getters, setters, builders, records | Reduce boilerplate significativamente |
| **SpringDoc OpenAPI** | Documentacion Swagger/OpenAPI 3.1 | Genera documentacion automatica del API |
| **Testcontainers** | Tests de integracion con PostgreSQL real | Tests confiables contra BD real en Docker |
| **WireMock** | Mock de servicios externos en tests | Simula respuestas de otros microservicios |
| **Awaitility** | Tests asincronos | Verifica resultados de operaciones asincronas (Kafka) |
| **ArchUnit** | Tests de arquitectura | Valida reglas hexagonales (dependencias de paquetes) |
| **Resilience4j** | Circuit breaker, retry | Proteccion contra fallos de servicios dependientes |
| **Micrometer** | Metrics | Integracion con Prometheus/Grafana |
| **Spring Boot Actuator** | Health, info, metrics | Observabilidad del servicio |

### 3.4 Herramientas de Desarrollo

| Herramienta | Uso |
|-------------|-----|
| **Maven** | Build tool y gestion de dependencias |
| **Docker** | Containerizacion y desarrollo local |
| **Docker Compose** | Orquestacion de servicios (PostgreSQL, Kafka) |
| **IntelliJ IDEA** | IDE principal para desarrollo Java |
| **Postman / Bruno** | Testing de endpoints REST |
| **DBeaver** | Cliente grafico para PostgreSQL |
| **Liquibase** | Gestion de migraciones de base de datos |

### 3.5 Testing

| Tipo | Herramienta | Uso |
|------|------------|-----|
| Unit Tests | JUnit 5 + Mockito | Pruebas de dominio y use cases |
| Integration | Spring Boot Test + Testcontainers | Pruebas con BD real |
| API Tests | MockMvc / WebTestClient | Pruebas de endpoints |
| Architecture | ArchUnit | Validar reglas de paquetes |

---

## 4. Endpoints

### 4.1 Personas

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/persons` | Crear persona |
| GET | `/api/v1/persons/{id}` | Obtener persona |
| PUT | `/api/v1/persons/{id}` | Actualizar persona |
| PATCH | `/api/v1/persons/{id}/status` | Activar/desactivar |
| GET | `/api/v1/persons` | Listar personas |

### 4.2 Usuarios

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/users` | Crear usuario |
| GET | `/api/v1/users/{id}` | Obtener usuario |
| PUT | `/api/v1/users/{id}` | Actualizar usuario |
| PATCH | `/api/v1/users/{id}/status` | Activar/desactivar |
| POST | `/api/v1/users/{id}/change-password` | Cambiar contrasena |

### 4.3 Autenticacion

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Iniciar sesion (correo o username) |
| POST | `/api/v1/auth/logout` | Cerrar sesion |
| POST | `/api/v1/auth/refresh` | Rotar la sesion: devuelve un `sessionId` nuevo y cierra el anterior |
| GET | `/api/v1/auth/me` | Usuario actual (`?username=` o `?email=`) |

**Refresh token.** No hay JWT: el `sessionId` opaco cumple las dos funciones.
`POST /auth/refresh` recibe el `sessionId` vigente en el cuerpo y responde con
otro distinto; el anterior se cierra con un `UPDATE ... WHERE status='Active'`
de un solo uso, de modo que dos renovaciones concurrentes con el mismo token
solo producen una sesion nueva. Si el cliente no renueva antes de
`session-timeout-minutes` (480 por defecto, igual que el seed de
`configuration.security_configuration`), la sesion expira y todo
`/api/v1/auth/refresh` o peticion autenticada responde 401.

**Expiracion perezosa.** `GET /api/v1/sessions/{id}` cierra la sesion vencida al
leerla. Como ese GET es el que usan los `AuthTokenFilter` de todos los
microservicios para validar el bearer, la expiracion se aplica en toda la
plataforma sin duplicar logica en los demas servicios.

### 4.4 Recuperacion de contrasena

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/api/v1/auth/forgot-password` | Genera el codigo de 6 digitos y lo envia por correo (`{email}`) |
| POST | `/api/v1/auth/verify-code` | Valida el codigo y deja el reto verificado (`{email, code}`) |
| POST | `/api/v1/auth/reset-password` | Aplica la contrasena nueva (`{email, password}`) |

Los tres son publicos (aun no hay sesion): la autorizacion la da el reto
verificado.

- **Codigo**: 6 digitos, SHA-256 en memoria, TTL 10 min, 5 intentos, reenvio
  cada 60 s (las mismas constantes del front). Se guarda solo el hash y la
  comparacion es en tiempo constante.
- **Anti-enumeracion**: `forgot-password` responde 202 exista o no la cuenta, y
  `verify-code`/`reset-password` devuelven 401 identico si no hay reto.
- **Politica**: `reset-password` valida la contrasena contra
  `identity.password_policy` antes de consumir el reto y cierra todas las
  sesiones abiertas del usuario.
- **Correo**: identity no habla SMTP; entrega el mensaje a
  `POST /api/v1/emails` de **08-ms-notification** (interno, no publicado en
  Kong) mediante `faceattend.notification.base-url`.
- **Limitacion**: el almacén vive en memoria del JVM; un reinicio de identity
  descarta los codigos pendientes (el usuario vuelve a pedir uno). Si se necesita
  persistencia o multiples replicas, cambia solo `RecoveryCodePort`.

### 4.5 Sesiones

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | `/api/v1/sessions` | Listar sesiones del usuario |
| DELETE | `/api/v1/sessions/{id}` | Revocar sesion |

---

## 5. Domain Events

El servicio Identity publica estos eventos via Kafka:

| Evento | Trigger | Consumidores tipicos |
|--------|---------|---------------------|
| `PersonCreated` | Nueva persona registrada | Academic, Biometric |
| `PersonActivated` | Persona activada | Todos |
| `PersonDeactivated` | Persona desactivada | Todos |
| `UserCreated` | Nuevo usuario creado | Authorization |
| `UserAuthenticated` | Login exitoso | — |
| `UserAuthenticationFailed` | Login fallido | Notification |
| `UserSessionStarted` | Sesion abierta | — |
| `UserSessionClosed` | Sesion cerrada | — |
| `PasswordChanged` | Contrasena cambiada | — |

---

## 6. Estructura del Proyecto

```
01-ms-identity/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/com/faceattend_edu/identity_service/
│   │   │   ├── adapter/
│   │   │   │   ├── in/web/
│   │   │   │   │   ├── controller/    ← AuthController, PersonController, etc.
│   │   │   │   │   ├── dto/           ← AuthRequest, PersonDto, UserDto
│   │   │   │   │   └── mapper/        ← WebMapper implementations
│   │   │   │   └── out/persistence/
│   │   │   │       ├── entity/        ← PersonJpaEntity, UserJpaEntity
│   │   │   │       ├── repository/    ← Spring Data JPA repos
│   │   │   │       ├── mapper/        ← PersistenceMapper implementations
│   │   │   │       └── *Adapter.java  ← Port implementations
│   │   │   ├── application/
│   │   │   │   ├── port/
│   │   │   │   │   ├── in/            ← Use case interfaces
│   │   │   │   │   └── out/           ← Port interfaces
│   │   │   │   └── usecase/           ← Use case implementations
│   │   │   ├── config/                ← Security, Kafka, beans
│   │   │   ├── domain/
│   │   │   │   ├── model/             ← Person, User, UserSession
│   │   │   │   ├── event/             ← Domain events
│   │   │   │   ├── exception/         ← Domain exceptions
│   │   │   │   └── service/           ← Domain services
│   │   │   ├── shared/                ← Cross-cutting
│   │   │   └── IdentityServiceApplication.java
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/changelog/          ← Liquibase (embedded)
│   └── test/
└── target/
```

---

## 7. Configuracion

### application.yml (ejemplo)

```yaml
server:
  port: 8081

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/faceattend_db
    username: postgres
    password: postgres
    hikari:
      schema: identity
  jpa:
    hibernate:
      ddl-auto: validate
    properties:
      hibernate.default_schema: identity
  kafka:
    bootstrap-servers: localhost:9092
    group-id: identity-service

springdoc:
  api-docs:
    path: /api-docs
  swagger-ui:
    path: /swagger-ui.html
```

### 7.1 Propiedades de autenticacion (`faceattend.*`)

| Propiedad | Defecto | Descripcion |
|-----------|---------|-------------|
| `faceattend.auth.session-timeout-minutes` | `480` | Vigencia de la sesion opaca (start_date + esto) |
| `faceattend.recovery.code-ttl-minutes` | `10` | Vida del codigo de recuperacion |
| `faceattend.recovery.max-attempts` | `5` | Intentos fallidos antes de invalidar el codigo |
| `faceattend.recovery.resend-cooldown-seconds` | `60` | Espera minima entre reenvios |
| `faceattend.notification.base-url` | `http://localhost:8088` | 08-ms-notification (en compose: `http://ms-notification:8088`) |
| `faceattend.notification.internal-token` | *(vacio)* | Header `X-Internal-Token` si el destino lo exige |

Se sobrescriben por variable de entorno con la forma `FACEATTEND_AUTH_*`,
`FACEATTEND_RECOVERY_*` y `FACEATTEND_NOTIFICATION_*` (p. ej.
`FACEATTEND_NOTIFICATION_BASE_URL`).

---

## 8. Puertos del Servidor

| Puerto | Servicio |
|--------|----------|
| 8081 | REST API |
| 9092 | Kafka (externo) |
| 5432 | PostgreSQL (externo) |

---

## 9. Stack Actual

Identity esta implementado en **Java 21 + Spring Boot 4.1.1** con arquitectura hexagonal.

### Justificacion

- **Spring Security**: La libreria de seguridad mas madura del ecosistema JVM. JWT, sesiones Redis, refresh tokens y RBAC out-of-the-box.
- **Spring Data JPA**: Persistencia relacional con la unicidad compuesta `(document_type, document_number)` y `username` unico; el correo vive en `identity.person` con `uq_person_email` (unicidad entre filas vivas) y es la alternate key de login.
- **Spring Kafka**: Domain Events asincronos (`PersonCreated`, `UserLoggedIn`, ...).
- **Liquibase**: Migraciones versionadas del schema `identity`.
- **Testcontainers**: Tests de integracion con PostgreSQL real.
