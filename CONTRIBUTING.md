# Guía de contribución

Gracias por colaborar en FaceAttend EDU. Esta guía resume el flujo de trabajo real del
proyecto y cómo correr las pruebas de cada pieza.

## Flujo de trabajo

1. Crea tu rama **desde `develop`** (`git switch -c fix/mi-cambio origin/develop`).
   Nombres de rama habituales: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
2. Haz commits pequeños con **convención de mensajes** en inglés:
   `tipo(alcance): resumen en imperativo`, por ejemplo
   `fix(biometric): limit template reads to the caller's school`.
   Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`.
3. **No añadas trailers de coautoría automáticos** (`Co-Authored-By: …`) ni líneas
   generadas por herramientas en los commits ni en la descripción del PR.
4. Abre el _pull request_ **contra `develop`**. Describe qué cambia, cómo lo verificaste
   y qué queda pendiente.
5. El **CI debe estar en verde** antes de fusionar (`.github/workflows/ci.yml`).
6. Los PR se fusionan con **squash**; el título del PR pasa a ser el mensaje del commit
   en `develop`, así que escríbelo con la misma convención.

## Cambios en la base de datos

El modelo relacional se define en `database/faceattend_edu_mr_v4.dbml`: se actualiza
**primero** y luego se sincronizan `database/MODELO.md`, `CONVENCIONES.md`,
`ESTRUCTURA.md` y `SEEDS.md`. Reglas clave: sin FK entre contextos, bloque de
auditoría de 7 columnas y borrado lógico. Los seeds existentes no se editan: se añaden
_changesets_ nuevos.

## Pruebas por servicio

Los comandos son los que ejecuta el CI. Ejecútalos desde la carpeta indicada.

### Java (Spring Boot): `01-ms-identity`, `02-ms-authorization`, `04-ms-scheduling`, `05-ms-attendance`

Requiere JDK 21. Cada servicio trae su _wrapper_ de Maven (`mvnw`/`mvnw.cmd`).
Los servicios usan la librería compartida `back-end/shared/auth-java`; instálala antes
de la primera ejecución, como hace el CI (esa carpeta no tiene _wrapper_, usa `mvn`):

```bash
mvn -B -q -f back-end/shared/auth-java/pom.xml install -DskipTests
```

```bash
cd back-end/01-ms-identity
./mvnw test
```

### Node (Fastify): `03-ms-academic`, `07-ms-configuration`, `08-ms-notification`, `09-ms-quality`

Requiere Node 20 (los `package.json` piden `>=20.19`).

```bash
cd back-end/03-ms-academic
npm ci
npm test
```

El CI además ejecuta `npm test -- --coverage` y `npm run build`.
Las librerías `back-end/shared/auth-node` y `back-end/shared/node-infra` se prueban con
`npm test` en su carpeta.

### Python (FastAPI): `06-ms-biometric`

Requiere Python 3.12 y [Poetry](https://python-poetry.org/) (el CI usa 1.8.3).
`dlib`/OpenCV necesitan herramientas de compilación (`cmake`, `build-essential`,
`libopenblas-dev`, `liblapack-dev` en Debian/Ubuntu).

```bash
cd back-end/06-ms-biometric
poetry install --no-root
poetry run pytest
```

### Web y Mobile

Requieren Node 20.

```bash
cd front-end/Web      # o front-end/Mobile
npm ci
npm test
```

Las pruebas de **Web** fijan la zona horaria a `America/Bogota`
(`front-end/Web/jest.global-setup.js`): los _snapshots_ de reportes y PDF se grabaron en
hora de Colombia, así que no dependas de la zona horaria de tu máquina ni la cambies
para que pasen.

## Contratos OpenAPI (`docs/openapi`)

Cuando cambies un endpoint o un DTO, regenera los contratos y commitea el resultado; el
CI falla si hay diferencias.

```bash
# Servicios Java (usa Docker para una base temporal con las migraciones)
tools/openapi/generate.sh

# Biometric (FastAPI), desde back-end/06-ms-biometric
poetry run python ../../tools/openapi/biometric.py
```

Los servicios Node (03, 07, 08, 09) no tienen generador todavía; ver
`docs/openapi/README.md`.

## Seguridad

No publiques vulnerabilidades, credenciales ni datos biométricos en _issues_ o PR.
Sigue [SECURITY.md](SECURITY.md).
