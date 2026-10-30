# Flujos E2E del MVP

`tools/e2e/mvp-flujos.mjs` recorre los 6 flujos críticos del MVP contra el stack real,
pasando por Kong como las apps. Node 20 o superior, sin dependencias. Cada corrida crea su
propia sede de prueba (códigos y usuarios con prefijo `E2E`/`e2e.`) y al final la desactiva
con borrado lógico, así que no depende de datos sembrados ni choca con corridas anteriores.

| # | Flujo | Qué comprueba |
|---|---|---|
| 1 | Login y cambio de contraseña | La cuenta del Super Administrador con clave inicial entra, el gateway le bloquea las escrituras (`403 PASSWORD_CHANGE_REQUIRED`), cambia la clave, la anterior da 401 y la nueva entra sin restricción. En una cuenta nueva: clave equivocada 401, la política rechaza una clave corta y el cambio voluntario invalida la anterior. |
| 2 | Alta de sede, programa, ficha y aprendices | Alta pública de sede (`/onboarding/schools`); su administrador no entra hasta que el Super Administrador lo activa. El administrador crea programa, periodo, ficha, curso y ambiente; se dan de alta un instructor y dos aprendices (`/users/provision`), cada uno inicia sesión y acepta términos, y los aprendices quedan matriculados en la ficha. |
| 3 | Horario y sesión de clase | Bloque horario de la ficha; un segundo bloque en la misma sala y hora se rechaza; el instructor ve el bloque. La sesión de hoy nace `Open`, es única por bloque y fecha, y el instructor la ve. |
| 4 | Asistencia manual y cierre con ausentes | El instructor marca `Present` (MANUAL) a un aprendiz; un segundo registro del mismo aprendiz se rechaza. Al cerrar la sesión quedan `closedBy`/`closedAt` y ms-notification marca `Absent` al aprendiz sin registro (evento Kafka `scheduling.class-session.closed`); el aprendiz ve su ausencia. |
| 5 | Justificación con revisión | El aprendiz radica la justificación (`Pending`); una segunda del mismo registro se rechaza. Si el tipo exige soporte, aprobar sin PDF se rechaza y el aprendiz lo sube. El administrador la aprueba (`reviewedBy`/`reviewedAt`) y el aprendiz la ve aprobada. |
| 6 | Sesión web en cookie y cierre de sesión | La web sirve `/login`. Login con las cabeceras del SPA: cookie `fae_session` HttpOnly y sin id de sesión en el cuerpo. La cookie sirve en identity y en otro servicio; una escritura sin `X-Requested-With` da 403. El logout borra la cookie y la sesión deja de servir al instante en todo el gateway. |

**Qué no cubre:**

- **Asistencia facial y por huella.** Necesitan una cara o huella real, prueba de vida y el
  WebSocket biométrico; el flujo 4 usa el registro MANUAL, que pasa por el mismo endpoint de
  asistencia. La captura biométrica se prueba aparte (`back-end/99-api-gateway/tests/ws-ticket.mjs`).
- **La interfaz.** Los flujos llaman a la API con las mismas cabeceras que la web y el móvil; no
  abren un navegador ni pulsan botones. El flujo 6 solo comprueba que la web sirve `/login`.
- **Correos.** El CI no tiene servidor SMTP: las credenciales y avisos por correo fallan sin
  bloquear nada, y por eso las cuentas creadas sin correo no nacen con cambio de clave obligatorio
  (solo las de `bootstrap-admin.sh`, que es lo que prueba el flujo 1).
- **Doble factor (2FA).** Ninguna cuenta de prueba lo activa.

## En el CI

El workflow `.github/workflows/e2e.yml` corre en cada PR, pero **no debe ser un check obligatorio**: tarda unos 17 minutos y un fallo del entorno de Actions no debe bloquear la fusión (si falla, mira el resultado antes de fusionar).
Se dispara:

- a mano: *Actions → E2E flujos MVP → Run workflow* (casilla `sembrar` para correr también la siembra);
- cada lunes a las 04:00 (hora de Colombia), sobre la rama por defecto;
- en cada PR hacia `main` o `develop` y en cada push a él, salvo los borradores y los PR que solo tocan documentación (`**.md`, `docs/**`).

Pasos: genera un `.env` desechable con secretos aleatorios (`tools/e2e/ci/generar-env.sh`), construye
y levanta el stack con `docker compose up -d --build`, espera los healthchecks
(`tools/e2e/ci/esperar-stack.sh`), crea las cuentas de prueba con `database/scripts/bootstrap-admin.sh`
(`tools/e2e/ci/cuentas.sh`: el Super Administrador de los flujos, el de la siembra y las cuentas de
servicio del alta de sedes y de ms-notification) y recrea ms-identity y ms-notification para que las
lean, corre los flujos y después `tools/seed-api-test-data`. Al final baja el stack con sus volúmenes.
Ninguna credencial sale del job: todas se generan en él y se enmascaran en el log.

El runner trae Docker Compose 2.x, que rechaza que el `docker-compose.yml` raíz redefina servicios de
sus `include` (`conflicts with imported resource`); el job instala Compose v5.3.1, fijado por sha256.

La siembra **no decide** el resultado del job: mide la herramienta de siembra, no la plataforma. Su
estado sale en el resumen y, si falla, se suben los logs.

**Tiempo** (primera corrida completa, run 41004553863): unos 16 minutos. 11 de ellos son el build de
las imágenes (`docker compose up --build`), unos 30 s las cuentas y los healthchecks, 2 los flujos y
2 la siembra. Si el build pesa demasiado, las opciones son cachear capas con `docker buildx` y la
caché de Actions (`cache-from/cache-to: type=gha` en un override de compose solo para el CI) o
partir de imágenes ya publicadas por `deploy-backend.yml` en vez de construirlas.

### Estado conocido (octubre de 2026)

- **Flujo 4 falla contra el código de `develop`.** `GET /class-sessions/{id}/attendance` (y todo
  listado de asistencia sin filtro de estado) responde 409: el filtro apagado manda `""` como
  `attendance_status` y, con `stringtype=unspecified`, PostgreSQL intenta convertirlo al enum antes
  de evaluar la bandera (`AttendanceRecordPersistenceAdapter.search`). Por eso ms-notification no
  puede marcar los ausentes al cerrar. Es un bug de producción que este E2E detecta; se corrige
  aparte. En un stack local construido antes de ese cambio el flujo pasa.
- **La siembra falla en una base vacía** por desfase con la API actual: `GET /auth/me?username` da
  404, el enrolamiento facial 422 y la creación de alertas 400.

## Cómo leer el resultado

- **Resumen del job** (pestaña *Summary* de la ejecución): una tabla con cada flujo, su estado, cuántos
  pasos comprobó, cuánto tardó y el error si falló, más el resultado de la siembra.
- **Artefacto `e2e-resultados`**: `e2e-resultados.json` siempre y, si algo falló, `e2e-logs/` con el log
  de cada contenedor y `ps.txt` con su estado.

`e2e-resultados.json`:

```json
{
  "api": "http://localhost:8000/api/v1",
  "corrida": "6167e6",
  "duracionMs": 13000,
  "pasaron": 6, "fallaron": 0, "omitidos": 0,
  "limpieza": "datos de la corrida desactivados (borrado lógico)",
  "flujos": [
    { "n": 1, "id": "login", "nombre": "Login y cambio de contraseña", "estado": "pasó",
      "pasos": ["login del Super Administrador", "..."], "ms": 5118 }
  ]
}
```

- `estado`: `pasó`, `falló` (con `error`: el paso y la respuesta HTTP que lo rompió) u `omitido`
  (no corrió porque falló un flujo del que depende: 3, 4 y 5 encadenan los datos del 2; el 6 usa el
  instructor del 2).
- `pasos`: lo que se comprobó, en orden; en un flujo fallido, lo que alcanzó a pasar antes del error.
- Código de salida: 0 si todos pasan, 1 si alguno falla o se omite, 2 si falta configuración.

## A mano, contra el stack local

Desde la raíz del repo, con el stack arriba (`docker compose up -d`) y Git Bash o Linux/macOS:

```bash
bash tools/e2e/ci/cuentas.sh .env .env.e2e
```

Eso crea (o reinicia con clave nueva) las cuentas `e2e.*` y **escribe en tu `.env`** las cuentas de
servicio; si ya tienes `ONBOARDING_SERVICE_USER_ID` y `NOTIFICATION_SERVICE_*` propias y no quieres
cambiarlas, pásale una copia (`cp .env /tmp/e2e.env && bash tools/e2e/ci/cuentas.sh /tmp/e2e.env .env.e2e`)
y asegúrate de que tu ms-notification sí tiene cuenta de servicio: sin ella nadie queda `Absent` al
cerrar una clase y el flujo 4 falla. Si usaste `.env`, recrea los dos servicios:

```bash
docker compose up -d --no-deps --no-build ms-identity ms-notification
```

Y corre los flujos:

```bash
set -a; . ./.env.e2e; set +a; E2E_ALLOW_ADMIN_PASSWORD_CHANGE=1 node tools/e2e/mvp-flujos.mjs
```

El flujo 1 cambia la clave inicial de `e2e.admin` por una que solo vive en memoria; para repetir la
prueba vuelve a correr `cuentas.sh`, que la reinicia. `E2E_ALLOW_ADMIN_PASSWORD_CHANGE=1` es la
confirmación de que esa cuenta es desechable.

Variables opcionales: `API_URL` (`http://localhost:8000`), `WEB_ORIGIN` (`http://localhost:8090`, debe
estar en `KONG_CORS_ORIGINS`), `E2E_RESULTADOS` (ruta del JSON), `E2E_FLUJOS=4` (ese flujo y los que
necesita) y `E2E_LIMPIAR=0` (deja la sede de prueba activa para mirarla en la web).
