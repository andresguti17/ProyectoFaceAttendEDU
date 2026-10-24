# FaceAttend EDU

Plataforma de gestión de asistencia mediante reconocimiento biométrico (rostro y
huella) para instituciones educativas. Backend polyglot de 10 microservicios +
API Gateway, frontend Web (Expo/React Native Web) y app Mobile (Expo/React Native).

## Arquitectura

| Capa | Tecnología | Detalle |
|---|---|---|
| Backend | Java 21/Spring Boot, TypeScript/Fastify, Python/FastAPI, Go/Gin | [back-end/SERVICES.md](back-end/SERVICES.md) |
| Gateway | Kong OSS (DB-less) + Redis | [back-end/99-api-gateway](back-end/99-api-gateway) |
| Base de datos | PostgreSQL 17 (1 instancia, 8 schemas) + MongoDB (embeddings) | [database/MODELO.md](database/MODELO.md), [database/faceattend_edu_mr_v4.dbml](database/faceattend_edu_mr_v4.dbml) |
| Frontend Web | Expo / React Native Web | [front-end/Web](front-end/Web) |
| Frontend Mobile | Expo / React Native | [front-end/Mobile](front-end/Mobile) |

El modelo relacional, sus convenciones de nombrado y las reglas de negocio
derivadas están documentados en `database/` y son la fuente de verdad para
cualquier cambio de esquema (ver `AGENTS.md` en la raíz del proyecto padre).

## Arranque rápido

```bash
cp .env.example .env
docker compose up -d --build
```

Esto levanta Postgres, Mongo, Redis, Kafka, las migraciones Liquibase de los 8
schemas, los 10 microservicios, Kong y el frontend web. Ver
[COMPOSE.md](COMPOSE.md) para el detalle de redes, puertos, orden de arranque y
problemas conocidos.

```bash
docker compose ps                     # estado + salud de cada servicio
docker compose logs -f ms-identity    # logs de un servicio
docker compose down                   # detener (conserva los datos)
```

### Primer arranque (sin cuentas ni contraseñas por defecto)

1. Complete en `.env` todas las contraseñas y claves vacías de `.env.example`
   (`openssl rand -hex 24`). `docker compose` no arranca si falta alguna.
2. Las migraciones no crean cuentas. Cree el primer Super Administrador:

   ```bash
   BOOTSTRAP_ADMIN_USERNAME=admin.sede BOOTSTRAP_ADMIN_EMAIL=admin@sede.edu.co    BOOTSTRAP_ADMIN_PASSWORD='<12+ caracteres>' ./database/scripts/bootstrap-admin.sh
   ```

   Debe cambiar la contraseña en su primer ingreso. Detalle en [database/SEEDS.md](database/SEEDS.md).
3. Cada microservicio entra a PostgreSQL con su propio usuario (`<servicio>_app`), que solo
   puede leer y escribir su esquema. En local los crea el contenedor `db-service-logins`
   después de las migraciones; para comprobarlo:
   `./database/scripts/verify-schema-isolation.sh`.

### Alta pública de sedes (`ONBOARDING_SERVICE_USER_ID`)

El formulario público de registro de sedes (`POST /api/v1/onboarding/schools`) crea la
sede y su administrador sin una sesión previa. Para hacerlo, ms-identity abre una sesión
interna corta como una **cuenta de servicio** con rol Super Administrador, nunca la de
una persona. Mientras `ONBOARDING_SERVICE_USER_ID` esté vacío el endpoint responde 503.

Para activarlo:

```bash
# 1. Cuenta de servicio dedicada, con una contraseña aleatoria que nadie usa
BOOTSTRAP_ADMIN_USERNAME=svc.onboarding BOOTSTRAP_ADMIN_EMAIL=onboarding@sede.edu.co BOOTSTRAP_ADMIN_PASSWORD="$(openssl rand -hex 24)" ./database/scripts/bootstrap-admin.sh
# 2. Su user_id
docker exec faceattend-postgres psql -U postgres -d faceattend_db -tAc   "select user_id from identity.app_user where username = 'svc.onboarding'"
# 3. ONBOARDING_SERVICE_USER_ID=<ese user_id> en .env (en producción, en ENV_PROD_FILE)
docker compose up -d ms-identity
```

La sede y su administrador quedan **pendientes de activación** hasta que un Super
Administrador los active. El endpoint tiene un límite estricto por IP en Kong.

## Desarrollo

- Backend: cada servicio en `back-end/0N-ms-*` es independiente (su propio
  `pom.xml`/`package.json`/`pyproject.toml`/`go.mod`). Ver `SERVICE.md` dentro
  de cada carpeta.
- Mobile: `cd front-end/Mobile && npm install && npm start`.
- Web: `cd front-end/Web && npm install && npm run web`.

## Documentación

| Tema | Archivo |
|---|---|
| Infraestructura Docker (redes, puertos, troubleshooting) | [COMPOSE.md](COMPOSE.md) |
| Microservicios backend | [back-end/SERVICES.md](back-end/SERVICES.md) |
| Modelo de datos (autoridad) | [database/faceattend_edu_mr_v4.dbml](database/faceattend_edu_mr_v4.dbml) |
| Convenciones de modelado | [database/CONVENCIONES.md](database/CONVENCIONES.md) |
| Seeds / catálogos iniciales | [database/SEEDS.md](database/SEEDS.md) |
| Despliegue (perímetro, secretos, admin inicial) | [DESPLIEGUE.md](DESPLIEGUE.md) |

## Estado del proyecto

Este repositorio está en preparación activa para su primer despliegue estable.
El checklist de hardening pre-producción (tests, seguridad de contenedores,
consistencia del modelo de datos, CI) se trabaja en la rama
`chore/production-readiness`.
