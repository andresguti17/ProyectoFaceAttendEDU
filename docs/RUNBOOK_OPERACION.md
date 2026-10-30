# Runbook de operación

> Procedimientos para operar la instancia de producción (EC2 + Neon + Vercel). Este documento **no repite**
> la guía de despliegue: enlaza la sección que corresponde y añade solo los pasos de operación que faltaban.
> Lo que no se pudo comprobar en el repositorio está marcado `TODO`; no se inventan hosts, contactos ni plazos.
>
> Referencias: [DESPLIEGUE.md](../DESPLIEGUE.md) (arquitectura, secretos, despliegue, Mongo, monitoreo),
> [COMPOSE.md](../COMPOSE.md) (compose, redes, imágenes fijadas, respaldos),
> [SECURITY.md](../SECURITY.md) (reporte de vulnerabilidades) e [INCIDENTES.md](INCIDENTES.md)
> (respuesta a incidentes de seguridad).

| Dato | Valor |
|---|---|
| Responsable de guardia | `TODO` |
| Canal de avisos del monitor (`ALERT_WEBHOOK_URL`) | `TODO` (Slack o Mattermost del equipo) |
| Dónde está `DEPLOY_DIR` en el servidor | variable `EC2_DEPLOY_DIR` del environment `production` de GitHub |
| Acceso | SSH con la llave del equipo (gestor de secretos), ver [DESPLIEGUE.md §9](../DESPLIEGUE.md#9-operación-y-monitoreo) |

En todos los comandos, desde `DEPLOY_DIR`:

```bash
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"
```

---

## 1. Desplegar

El camino normal es automático: un push a `main` ejecuta `deploy-production.yml` (CI → migraciones en Neon →
backend en EC2 → frontend en Vercel). El job `workflow_dispatch` del mismo workflow permite desplegar solo una
parte (`target`: `all`, `database`, `backend` o `frontend`). Detalle y despliegue manual equivalente:
[DESPLIEGUE.md §4](../DESPLIEGUE.md#4-procedimiento-de-despliegue).

Comprobaciones después de desplegar:

```bash
$COMPOSE ps                                      # todo running / healthy (los *-liquibase no corren en prod)
docker ps --format "{{.Names}} | {{.Ports}}"    # nada publicado en 0.0.0.0 salvo Caddy 80/443
curl -s -o /dev/null -w '%{http_code}\n' https://<API_DOMAIN>/api/v1/health   # 200
tools/monitor/check.sh                          # una pasada del monitor; sale con 0 si todo está bien
```

El script remoto (`.github/scripts/deploy-backend-remote.sh`) ya espera hasta 600 s a que todos los servicios
estén sanos y falla el job si no lo están.

---

## 2. Volver atrás

### 2.1 Backend (EC2)

Hoy el despliegue **reconstruye** las imágenes en el servidor (`up -d --build`) y las etiqueta con
`FACEATTEND_IMAGE_TAG` (por defecto `latest`). Ni el workflow ni el script remoto fijan esa variable, así que,
salvo que `.env.prod` la defina, cada despliegue **sobrescribe** `faceattend/*:latest` y no queda una imagen
anterior a la que volver. `TODO`: confirmar qué valor tiene `FACEATTEND_IMAGE_TAG` en `ENV_PROD_FILE`.

**Vuelta atrás disponible siempre (reconstruye):** lo que indica el propio script remoto, volver a ejecutarlo
con el commit anterior. Desde GitHub: *Actions → deploy-backend → Run workflow* sobre el commit bueno; o en el
servidor:

```bash
cd <DEPLOY_DIR>
git fetch --prune origin && git checkout --detach <sha-anterior>
$COMPOSE up -d --build --remove-orphans
```

**Vuelta atrás por etiqueta (sin reconstruir, segundos en vez de minutos).** Requiere que el despliegue se haya
hecho con una etiqueta por versión, como recomienda `.env.example`:

```bash
# Al desplegar: la variable del shell tiene prioridad sobre la de .env.prod
FACEATTEND_IMAGE_TAG=$(git rev-parse --short HEAD) $COMPOSE up -d --build --remove-orphans

# Para volver: comprobar que la imagen anterior sigue en el host…
docker image ls 'faceattend/*' --format '{{.Repository}}:{{.Tag}}  {{.CreatedSince}}'
# …y arrancar con ella, con los compose del mismo commit (la configuración puede haber cambiado entre versiones)
git checkout --detach <sha-anterior>
FACEATTEND_IMAGE_TAG=<sha-anterior-corto> $COMPOSE up -d --no-build --remove-orphans
```

Limitaciones:

- `docker image prune` o la falta de disco borran las etiquetas antiguas; sin la imagen, solo queda reconstruir.
- **Las migraciones de Neon no se revierten.** Liquibase corre hacia adelante en `deploy-database.yml`; si la
  versión nueva cambió el esquema, la anterior puede no arrancar. `TODO`: definir el procedimiento (rollback de
  Liquibase o restauración de Neon, §3.2) antes de necesitarlo.
- `TODO`: hacer que el workflow pase `FACEATTEND_IMAGE_TAG=<sha>` al script remoto para que la vuelta por
  etiqueta esté disponible siempre (cambio de CI, fuera de este documento).

### 2.2 Frontend (Vercel)

El frontend se despliega con `vercel deploy --prod` desde `deploy-frontend.yml`. Volver atrás = desplegar el
commit anterior (*Actions → deploy-frontend → Run workflow*). `TODO`: confirmar si el equipo usa la promoción
de un despliegue anterior desde el panel de Vercel; no está documentado en el repositorio.

### 2.3 App móvil

Una actualización OTA se revierte con `eas update:republish` de una actualización anterior
([DESPLIEGUE.md §14.3](../DESPLIEGUE.md#143-actualizaciones-ota-eas-update)). Un APK no se revierte: hay que
publicar uno nuevo.

---

## 3. Respaldos y restauración

Los scripts están en `database/scripts/` y su uso general en [COMPOSE.md §11](../COMPOSE.md#11-backups).

### 3.1 Qué cubre cada script

| Script | Qué hace | Dónde sirve hoy |
|---|---|---|
| `backup.sh` | `pg_dump` de `faceattend_db` dentro de `faceattend-postgres`, `mongodump` dentro de `faceattend-mongo` y copia de `/data` de `faceattend-minio` si está corriendo. Con `BACKUP_PASSPHRASE`, cifra los dos volcados (AES-256-CBC, PBKDF2 de 600 000 iteraciones). | Stack local completo. En producción **no hay contenedor `faceattend-postgres`** (la base es Neon): la parte de Postgres falla allí. |
| `restore.sh <carpeta>` | Restaura los dos volcados (`pg_restore --clean --if-exists`, `mongorestore --drop`); descifra si encuentra `.enc`. Pide confirmación salvo `FORCE=1`. | Igual que `backup.sh`. |
| `verify-restore.sh` | Levanta Postgres y Mongo desechables (`fae-vr-*`), respalda, restaura en otro par vacío y compara filas, documentos y un hash; prueba también que una passphrase equivocada se rechaza. | Cualquier equipo con docker y openssl. No toca el stack. |

### 3.2 Producción

- **PostgreSQL (Neon):** `TODO`. Ni `backup.sh` ni el repositorio describen cómo se respalda o restaura Neon
  (restauración a un punto en el tiempo del proveedor o `pg_dump` con la cadena de conexión). Hay que decidirlo,
  probarlo y escribirlo aquí.
- **MongoDB (biometría):** corre en el servidor como `faceattend-mongo`; la parte de Mongo de `backup.sh` sirve.
  Mientras no exista un script solo para Mongo, `TODO`: comprobar en el servidor el volcado manual equivalente:

  ```bash
  docker exec faceattend-mongo mongodump --username "$MONGO_USER" --password "$MONGO_PASSWORD" \
    --authenticationDatabase admin --archive=/tmp/mongo.archive --gzip
  docker cp faceattend-mongo:/tmp/mongo.archive ./mongo.archive.gz && docker exec faceattend-mongo rm /tmp/mongo.archive
  ```

- **MinIO (soportes de justificación):** `backup.sh` copia `/data`; restaurarlo exige el mismo
  `MINIO_KMS_SECRET_KEY`.
- **Claves:** `PII_ENCRYPTION_KEY`, `PII_HASH_KEY`, `BIOMETRIC_ENCRYPTION_KEY`, `MINIO_KMS_SECRET_KEY` y la
  `BACKUP_PASSPHRASE` se guardan **aparte** del respaldo; sin ellas lo restaurado no se puede leer
  ([DESPLIEGUE.md §3](../DESPLIEGUE.md#3-secretos-de-producción-env_prod_file)).
- Programación: ningún respaldo es automático. `TODO`: cron en el servidor, retención y destino fuera del
  servidor.

### 3.3 Restaurar (stack con Postgres local)

```bash
./database/scripts/verify-restore.sh                       # primero: confirmar que el procedimiento funciona
read -s BACKUP_PASSPHRASE; export BACKUP_PASSPHRASE MONGO_USER MONGO_PASSWORD
./database/scripts/restore.sh database/backups/<AAAAMMDD-HHMMSS>
docker compose restart                                      # o el compose que corresponda, para que los servicios relean
```

Después: login de prueba, una consulta de asistencia y `GET /api/v1/biometric/<person_id>/summary` de una
persona inscrita.

---

## 4. Rotar la contraseña de MongoDB

Procedimiento completo en [DESPLIEGUE.md §6](../DESPLIEGUE.md#6-mongodb-autenticación-y-rotación-de-la-contraseña).
Resumen y orden importante:

1. En el servidor, con los valores fuera del historial del shell:
   ```bash
   read -s MONGO_OLD_PASSWORD; read -s MONGO_NEW_PASSWORD; export MONGO_USER MONGO_OLD_PASSWORD MONGO_NEW_PASSWORD
   ./database/scripts/rotate-mongo-password.sh      # exige 16+ caracteres en la nueva
   ```
2. Actualizar `MONGO_PASSWORD` **en el secret `ENV_PROD_FILE`** y en `.env.prod`. Si solo se cambia `.env.prod`,
   el siguiente despliegue lo sobrescribe con el valor viejo del secret y `ms-biometric` deja de conectar.
3. `$COMPOSE up -d --force-recreate mongodb ms-biometric`.
4. Comprobar: `docker logs faceattend-ms-biometric` sin errores de autenticación y `tools/monitor/check.sh` en 0.

Si `ms-biometric` no conecta tras la rotación, la causa casi siempre es el paso 2 (ver la tabla de
[DESPLIEGUE.md §10](../DESPLIEGUE.md#10-troubleshooting)). Frecuencia: cada 6 meses o ante sospecha de exposición
([DESPLIEGUE.md §12](../DESPLIEGUE.md#12-datos-sensibles-de-la-instancia)); si hay sospecha, tratarlo además
como incidente ([INCIDENTES.md](INCIDENTES.md)).

---

## 5. Qué mirar ante cada alerta del monitor

`tools/monitor/check.sh` (cron cada 5 minutos, [DESPLIEGUE.md §9](../DESPLIEGUE.md#alertas-mínimas-ops-02))
envía `ALERTA: …` cuando el estado pasa de bien a mal y `RECUPERADO: …` al revés. Cada problema del mensaje
empieza por una de estas palabras:

| Mensaje | Qué significa | Qué revisar |
|---|---|---|
| `salud: <url> respondió 000` (o `sin respuesta`) | Nada contestó en 10 s: Caddy caído, DNS o certificado | `docker ps` (¿`faceattend-caddy` arriba?), `docker logs faceattend-caddy`, que `<API_DOMAIN>` resuelva a la instancia (el nombre `ec2-…` cambia si se detuvo). Si no hay SSH, la instancia entera está caída: consola de AWS (`TODO`: quién tiene acceso). |
| `salud: <url> respondió 502/503/504` | Caddy responde pero Kong o el servicio no | `docker logs faceattend-kong --since 10m`, `$COMPOSE ps` para ver qué servicio no está `healthy`. |
| `salud: <url> respondió 401/403/404` | Cambió la ruta pública de salud o la configuración de Kong | Ruta `/api/v1/health` en `kong.yml` (está en la lista de prefijos públicos) y el último despliegue. |
| `contenedor <nombre>: … (unhealthy)` | El healthcheck falla | `docker logs <nombre> --since 15m`; dependencia (Neon, Mongo, Redis, Kafka) caída o credencial rotada a medias (§4). |
| `contenedor <nombre>: Restarting …` / `Exited (n)` | El proceso termina | `docker logs <nombre>`; un `... is required` es un secreto que falta en `.env.prod` ([DESPLIEGUE.md §10](../DESPLIEGUE.md#10-troubleshooting)). Si empezó con un despliegue, §2. |
| `kong: N respuestas 5xx en 5m` | Errores del lado servidor por encima de `MAX_5XX` | `docker logs faceattend-kong --since 5m \| grep '" 5[0-9][0-9] '` para ver qué ruta (y por tanto qué servicio); luego los logs de ese servicio. |
| `disco / al N%` | Uso de disco sobre `DISK_MAX_PCT` (85) | `docker system df`; imágenes viejas (`docker image prune` borra también las etiquetas de vuelta atrás, §2.1); respaldos en `database/backups/`; logs. |
| `docker no está disponible en este equipo` | El cron corre sin acceso al socket de Docker | Usuario del cron en el grupo `docker`, o el servicio Docker detenido (`systemctl status docker`). |

El monitor corre en el mismo servidor: si la instancia cae, no avisa. `TODO`: monitor externo sobre la URL
pública (p. ej. UptimeRobot), como recomienda DESPLIEGUE.md §9.

Si la alerta apunta a un acceso no autorizado o a una fuga, seguir [INCIDENTES.md](INCIDENTES.md), no solo este
runbook.

---

## 6. Pasar la web de modo cookie a modo bearer

Desde el S-10 la web guarda la sesión en una cookie HttpOnly (`fae_session`) por defecto. El modo bearer (token en
`sessionStorage`, cabecera `Authorization`) sigue disponible como salida. Diseño y motivos:
[DISENO_S10_SESION_HTTPONLY.md](DISENO_S10_SESION_HTTPONLY.md).

**Cuándo usarlo:** la cookie no llega (un proxy elimina `Cookie`, el navegador la bloquea) y los usuarios
vuelven al login tras cada acción; o la web se sirve por `http://` en una IP de la red local, donde el navegador
descarta la cookie `Secure`.

`EXPO_PUBLIC_SESSION_MODE` se lee en `front-end/Web/src/config/env.ts` y **se hornea en el build**: cambiarla
exige volver a construir la web.

1. En Vercel, variables del proyecto: `EXPO_PUBLIC_SESSION_MODE=bearer`. Las demás (`EXPO_PUBLIC_API_URL`,
   `EXPO_PUBLIC_WS_URL`) no cambian. `TODO`: quién tiene acceso al proyecto de Vercel.
2. Redesplegar el frontend (*Actions → deploy-frontend → Run workflow*, o `deploy-production.yml` con
   `target: frontend`).
3. Backend: no hace falta tocar nada. Kong da prioridad a `Authorization` sobre la cookie y identity responde
   como siempre cuando la petición no trae `X-Session-Mode: cookie`.
4. Comprobar en el navegador (ventana nueva): el login funciona, `sessionStorage.auth_token` contiene el id de
   sesión, las peticiones llevan `Authorization: Bearer` y el kiosco biométrico conecta su WebSocket.

En red local sin Vercel, la alternativa sin cambiar de modo es `FACEATTEND_SESSION_COOKIE_SECURE=false` en el
`.env` del servidor (ver `.env.example`) y recrear `ms-identity`.

**Volver al modo cookie:** quitar la variable (o ponerla en cualquier valor distinto de `bearer`) y redesplegar.
Las sesiones abiertas en modo bearer siguen válidas hasta caducar (8 h) o cerrar sesión.

Coste de quedarse en bearer: un XSS puede leer el token y usarlo desde otro equipo (la razón del S-10). La CSP
`script-src 'self'` de `vercel.json` sigue siendo la barrera principal. Registrar el cambio y el motivo, y
volver al modo cookie en cuanto se corrija la causa.

---

## 7. Pendientes de este runbook

- `TODO`: responsable de guardia y canal de avisos.
- `TODO`: valor de `FACEATTEND_IMAGE_TAG` en producción y etiqueta por commit en el workflow (§2.1).
- `TODO`: respaldo y restauración de Neon, programación y retención de respaldos (§3.2).
- `TODO`: procedimiento de vuelta atrás de migraciones (§2.1).
- `TODO`: monitor externo (§5).
