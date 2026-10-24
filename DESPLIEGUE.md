# FaceAttend EDU — Despliegue en AWS EC2 con Neon PostgreSQL

> **Contenido:** Parte I (secciones 1–12): backend en AWS EC2 + Neon + Vercel. **Parte II (secciones 13–20, al final):** APK con EAS Build, actualizaciones OTA y validación de persistencia de la app móvil.
>
> **Regla de esta guía:** ningún host, usuario, contraseña ni clave real se escribe aquí. Todos los valores viven en el secret `ENV_PROD_FILE` de GitHub Actions (que se copia a `.env.prod` en el servidor) o en el gestor de secretos del equipo.

---

## 1. Arquitectura desplegada

- **EC2** (Debian, t3.xlarge, 150 GB gp3) con Docker Compose: 9 microservicios, Kong, MongoDB, Redis, Kafka, Portainer y Caddy.
- **Neon PostgreSQL**: 8 esquemas (uno por bounded context), migrados con Liquibase desde GitHub Actions.
- **Vercel**: frontend web estático (`expo export`), que llama a `https://<API_DOMAIN>`.
- **Caddy** termina TLS (Let's Encrypt) delante de Kong. Es lo único que escucha en Internet.

```
Internet ──443/80──▶ Caddy ──red Docker──▶ Kong :8000 ──▶ ms-* :8081-8089 ──▶ Neon / MongoDB / Redis / Kafka
```

| Servicio | Puerto | Publicado en el host | Acceso |
|---|---|---|---|
| Caddy | 80 / 443 | `0.0.0.0` | Internet (único punto de entrada) |
| Kong proxy | 8000 | `127.0.0.1` (`KONG_PROXY_BIND_IP=127.0.0.1`) | solo Caddy y el propio host |
| Kong admin | 8001 | `127.0.0.1` fijo | túnel SSH |
| ms-* | 8081–8089 | `127.0.0.1` (`BIND_IP=127.0.0.1`) | solo Kong |
| MongoDB / Redis / Kafka | 27017 / 6379 / 9092 | `127.0.0.1` fijo | solo la red Docker y el host |
| Portainer | 9443 | `127.0.0.1` fijo | túnel SSH |

---

## 2. Perímetro de red (security group de AWS)

Reglas de entrada **únicas** del security group de la instancia:

| Puerto | Origen | Motivo |
|---|---|---|
| 443/tcp y 443/udp | `0.0.0.0/0` | HTTPS (Caddy) |
| 80/tcp | `0.0.0.0/0` | Desafío ACME de Let's Encrypt y redirección a HTTPS |
| 22/tcp | IP pública del operador (`/32`) | SSH de administración y despliegue de GitHub Actions* |

\* Si el despliegue por SSH desde GitHub Actions necesita el 22 abierto a más rangos, restrinja a los rangos publicados de GitHub (`https://api.github.com/meta`, clave `actions`) o use un runner autoalojado. **Nunca** abra 8000, 8001, 8081–8089, 5432, 27017, 6379, 9092 ni 9443.

Verificación desde fuera de la VPC (cualquier equipo con Internet):

```bash
for p in 22 80 443 8000 8001 8081 8086 9092 27017 6379 9443; do
  nc -z -w 3 <API_DOMAIN> $p && echo "$p ABIERTO" || echo "$p cerrado"
done
```

Solo 80 y 443 (y 22 desde la IP del operador) deben responder.

---

## 3. Secretos de producción (`ENV_PROD_FILE`)

El workflow `deploy-backend.yml` copia el secret `ENV_PROD_FILE` a `$DEPLOY_DIR/.env.prod`. Compose **falla al arrancar** si falta cualquier contraseña obligatoria (`${VAR:?}`): no existen valores por defecto.

Variables obligatorias (genere cada secreto con `openssl rand -base64 32`):

| Variable | Uso |
|---|---|
| `NEON_JDBC_URL`, `NEON_HOST`, `NEON_USER`, `NEON_PASSWORD`, `POSTGRES_DB` | conexión a Neon (copiar del panel de Neon; nunca a este documento) |
| `POSTGRES_PASSWORD` | requerido por la interpolación del compose base; use el mismo valor que `NEON_PASSWORD` |
| `MONGO_USER`, `MONGO_PASSWORD` | usuario root de MongoDB (autenticación obligatoria) |
| `BIOMETRIC_LIVENESS_CHALLENGE_SECRET` | firma de los retos de prueba de vida (≥ 32 caracteres) |
| `API_DOMAIN` | nombre DNS del host (Caddy) |
| `BIND_IP=127.0.0.1`, `KONG_PROXY_BIND_IP=127.0.0.1` | perímetro: nada de la aplicación escucha fuera del host |
| `ONBOARDING_SERVICE_USER_ID` | cuenta de servicio del alta pública de sedes (ver §7) |
| `KONG_CORS_ORIGINS` | orígenes web permitidos por CORS, separados por coma (p. ej. el dominio de Vercel); sin valor por defecto en producción |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_KMS_SECRET_KEY` | almacenamiento de soportes de justificación; la clave KMS (`nombre:$(openssl rand -base64 32)`) cifra cada archivo y debe respaldarse aparte: sin ella los soportes no se pueden leer |
| `PII_ENCRYPTION_KEY`, `PII_HASH_KEY`, `BIOMETRIC_ENCRYPTION_KEY` | cifrado en reposo de los datos personales y de las plantillas biométricas (Ley 1581; `openssl rand -base64 32` cada una); respaldarlas aparte de los datos: sin ellas la información no se puede leer, y cambiarlas exige volver a cifrar |
| `IDENTITY_DB_PASSWORD` … `NOTIFICATION_DB_PASSWORD` (8) | un usuario de Neon por servicio (`<servicio>_app`), limitado a su esquema; también como secrets del environment `production` para `deploy-database.yml`, que los crea con `database/scripts/create-service-logins.sh` |

Las migraciones (`deploy-database.yml`) leen `NEON_JDBC_URL`, `NEON_USER` y `NEON_PASSWORD` de los secrets del environment `production` y siempre se ejecutan con `--contexts=seed` (catálogos); los changesets `demo` nunca llegan a producción.

---

## 4. Procedimiento de despliegue

El despliegue es automático al hacer push a `main` (`deploy-production.yml`): CI → migraciones en Neon → backend en EC2 → frontend en Vercel. El script remoto es `.github/scripts/deploy-backend-remote.sh`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --remove-orphans
```

Despliegue manual equivalente (desde el host, con el repo clonado en `DEPLOY_DIR`):

```bash
ssh -i <llave-del-equipo>.pem admin@<API_DOMAIN>
cd <DEPLOY_DIR>
git fetch --prune origin && git checkout --detach <sha>
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --remove-orphans
docker ps --format "{{.Names}} | {{.Ports}}"   # ningún puerto salvo 80/443 en 0.0.0.0
```

**Primera vez con el cifrado de datos (Ley 1581):** identity cifra sola las personas existentes al arrancar y cada 5 minutos. Las plantillas biométricas ya guardadas se cifran una vez, a mano, después del despliegue:

```bash
docker exec faceattend-ms-biometric python scripts/encrypt_existing_biometrics.py --dry-run   # solo cuenta
docker exec faceattend-ms-biometric python scripts/encrypt_existing_biometrics.py
```

---

## 5. Administrador inicial (sin credenciales por defecto)

Las migraciones **no crean ninguna cuenta**. Las cuentas de la versión anterior (`admin.faceattend`, `instructor.faceattend`, `aprendiz.faceattend`), cuyas contraseñas estaban publicadas en el repositorio, quedan deshabilitadas por el changeset `004-disable-seeded-default-accounts` en cuanto corren las migraciones.

Crear el primer Super Administrador (una sola vez, desde un equipo con `psql` y acceso a Neon):

```bash
export PSQL="psql <cadena de conexión de Neon, tomada del gestor de secretos>"
BOOTSTRAP_ADMIN_USERNAME=<usuario> \
BOOTSTRAP_ADMIN_EMAIL=<correo institucional> \
BOOTSTRAP_ADMIN_PASSWORD='<contraseña temporal de 12+ caracteres>' \
  ./database/scripts/bootstrap-admin.sh
```

Para reactivar la cuenta histórica con una contraseña nueva, en lugar de crear otra:

```bash
BOOTSTRAP_ADMIN_USERNAME=admin.faceattend BOOTSTRAP_ADMIN_PASSWORD='<nueva>' \
  ./database/scripts/bootstrap-admin.sh --reset
```

Garantías:
- La contraseña viaja como variable de `psql` (`:'pw'`) y se guarda con bcrypt de costo 12; nunca queda en el repositorio ni en una migración.
- La cuenta nace con `must_change_password = TRUE`: la web, el móvil y el gateway (Kong) obligan a cambiarla en el primer ingreso; hasta entonces el gateway solo permite lecturas y el cambio de clave.
- El script nunca se ejecuta solo (ni en compose ni en CI).

Comprobación: un login con las credenciales antiguas responde **401**, y el login con la cuenta nueva devuelve `mustChangePassword: true`.

---

## 6. MongoDB: autenticación y rotación de la contraseña

MongoDB arranca con `mongod --auth` y el usuario root sale de `MONGO_USER`/`MONGO_PASSWORD`. `MONGO_INITDB_ROOT_*` solo se aplican **la primera vez** que se crea el volumen, así que cambiar la variable no cambia la contraseña real. Para rotarla en un volumen existente:

```bash
# En el host, con ambos valores en el entorno (no en el historial: use `read -s`)
read -s MONGO_OLD_PASSWORD; read -s MONGO_NEW_PASSWORD; export MONGO_USER MONGO_OLD_PASSWORD MONGO_NEW_PASSWORD
./database/scripts/rotate-mongo-password.sh
# Actualice MONGO_PASSWORD en el secret ENV_PROD_FILE (y en .env.prod) y recree los consumidores
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate mongodb ms-biometric
```

---

## 7. Alta pública de sedes

`POST /api/v1/onboarding/schools` abre una sesión interna como la cuenta de servicio `ONBOARDING_SERVICE_USER_ID` (un `user_id` de un Super Administrador dedicado, nunca el de una persona). Sin esa variable el endpoint responde 503. Créela con `bootstrap-admin.sh` (usuario propio, contraseña aleatoria que nadie usa) y copie su `user_id` al secret.

---

## 8. Frontend en Vercel

Variable del proyecto en Vercel: `EXPO_PUBLIC_API_URL=https://<API_DOMAIN>`. El flujo es Vercel → `https://<API_DOMAIN>` (Caddy) → Kong → microservicio.

---

## 9. Operación y monitoreo

Todo acceso administrativo va por túnel SSH:

```bash
ssh -L 9443:127.0.0.1:9443 -L 8001:127.0.0.1:8001 admin@<API_DOMAIN>   # Portainer y Kong admin
docker ps
docker logs faceattend-kong
docker logs faceattend-ms-identity
curl -s -o /dev/null -w '%{http_code}\n' https://<API_DOMAIN>/api/v1/health
```

---

## 10. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `docker compose` termina con `... is required` | falta un secreto en `.env.prod` | agregarlo al secret `ENV_PROD_FILE` (ver §3) |
| Contenedor reiniciando | healthcheck de una dependencia | esperar 30–60 s y revisar `docker logs` |
| ms-biometric no conecta a Mongo | contraseña rotada solo en un lado | alinear `MONGO_PASSWORD` con la real (§6) |
| Neon rechaza la conexión | credenciales o host | revisar `NEON_*` en el secret |
| Login del admin responde 401 | la migración 004 deshabilitó la cuenta histórica | `bootstrap-admin.sh --reset` (§5) |
| Frontend no conecta | `EXPO_PUBLIC_API_URL` distinta del dominio | usar `https://<API_DOMAIN>` |

---

## 11. Recursos de referencia

- EBS 150 GB; imágenes Docker ~4 GB; bases ~2 GB.
- Memoria 16 GB: microservicios Java ~8 GB, infraestructura ~4 GB.

---

## 12. Datos sensibles de la instancia

- `.env.prod` vive solo en `$DEPLOY_DIR` del servidor (permisos `600`) y en el secret `ENV_PROD_FILE`.
- La llave SSH del equipo se guarda en el gestor de secretos; nunca en el repositorio.
- Rotación: contraseñas de Mongo y Neon cada 6 meses o ante cualquier sospecha de exposición (ver `fae-docs/00-governance/security-policy.md`).

---

# Parte II — App móvil: APK con EAS Build, actualizaciones OTA y validación de persistencia

> Alcance: generar el APK de la app React Native (Expo) con **Expo EAS Build en la nube**, vincular el proyecto con Expo, publicar actualizaciones y comprobar que el registro facial llega al backend y a la base de datos. No cambia la arquitectura ni el código funcional.
> Verificado contra `main` v1.2.0 (2026-10-19). Todo dato que el repositorio **no** contiene (cuenta Expo, `projectId`, token) está marcado **Supuesto** y no se inventa.
> Alternativa sin cuenta Expo: compilación local con Gradle (`GENERAR_APK.md`, fuera del repo, en la carpeta del equipo).

## 13. Requisitos previos de la app móvil

| Requisito | Valor real del proyecto | Comprobación |
|---|---|---|
| Node.js | **≥ 20** (**Supuesto:** el repo no define `engines`; Expo SDK 57 / RN 0.86 lo exigen) | `node -v` |
| npm | el de Node; hay `package-lock.json` → usar `npm ci` | `npm -v` |
| EAS CLI | `>= 12.0.0` (lo exige `eas.json`) | `npm install -g eas-cli` · `eas --version` |
| Cuenta Expo | **Supuesto:** el equipo tiene una cuenta y una organización en https://expo.dev. El repo **no** guarda usuario, token ni `projectId` | `eas whoami` |
| Identificador Android | `edu.faceattend.app` (`app.json → expo.android.package`) | — |
| Nombre visible | `FaceAttend EDU` (`expo.name`); `slug` = `faceattend-edu` (no cambiarlo: lo usa Expo para identificar el proyecto) | — |
| Firma | **Gestionada por EAS** (keystore en la nube). La primera vez, responder *Yes* a generar una | `eas credentials` |
| Variable de entorno | `EXPO_PUBLIC_API_URL` (pública: queda grabada en el APK; **nunca** poner claves en variables `EXPO_PUBLIC_*`) | ver 15 |

Estado actual de la configuración (leído del repo):
- `app.json`: `usesCleartextTraffic: true`, plugin `expo-camera` con el texto del permiso de cámara, `runtimeVersion.policy = "appVersion"`, `updates.enabled = false`, icono adaptable con `foregroundImage`.
- `eas.json`: perfiles `development`, `preview` y `production`; `preview` y `production` ya generan **APK** (`android.buildType: "apk"`) y llevan un `channel` con el mismo nombre del perfil.
- **No hay** `expo-updates` en `package.json`, ni `extra.eas.projectId` ni `updates.url` en `app.json`. Hoy la app **no puede recibir actualizaciones OTA** (ver 14.3).

## 14. Vinculación con Expo y actualizaciones

### 14.1 Vincular el proyecto con la cuenta y el `projectId`
Desde `front-end/Mobile`:
```powershell
npm ci
eas login                  # escribe tú el usuario y la contraseña (o usa EXPO_TOKEN en CI)
eas whoami                 # confirma la cuenta/organización
eas init                   # crea o enlaza el proyecto y escribe extra.eas.projectId en app.json
```
- Si el proyecto **ya existe** en expo.dev, usa `eas init --id <PROJECT_ID>` con el id que muestra el panel (Project → Settings). **Supuesto:** ese id lo aporta el equipo.
- Confirmar que se usa el proyecto correcto: `eas project:info` debe mostrar el mismo `slug` (`faceattend-edu`), el mismo propietario y el mismo `projectId` que `app.json → expo.extra.eas.projectId`. Si difieren, no compiles: estarías firmando con las claves de otro proyecto.
- Confirmar que las **claves de firma** son las ya establecidas: `eas credentials -p android` → *Keystore* → debe listar la keystore existente (huella SHA-1). Si el equipo ya publicó APK antes y aquí aparece "no keystore", la cuenta no es la correcta. **No generes una nueva** sobre un proyecto ya distribuido: los teléfonos con el APK anterior no podrán actualizarlo (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`).
- Haz commit de `app.json` con el `projectId` para que todo el equipo use el mismo.

### 14.2 Expo Go frente a APK
| Herramienta | Para qué sirve aquí | Cómo |
|---|---|---|
| **Expo Go** | Desarrollo rápido con recarga en vivo mientras se programa | `npx expo start` (misma Wi-Fi) y escanear el QR; `--tunnel` si la red lo bloquea. Usa el JavaScript del equipo de desarrollo, **no** el de producción |
| **APK de EAS** (`preview` / `production`) | Lo que se instala en los dispositivos de los usuarios | `eas build` (sección 16) |

**Supuesto:** Expo Go solo abre la app si su versión soporta el SDK 57 y los módulos usados; si no abre, usa un *development build* (`eas build --profile development`). La app usa `expo-camera`, `expo-secure-store` y `react-native-reanimated 4`; no se ha probado en Expo Go.

### 14.3 Actualizaciones OTA (`eas update`)
**Qué se propaga por OTA** (solo JavaScript y assets): pantallas, lógica, textos, estilos, imágenes y fuentes ya incluidas en el bundle.
**Qué exige un APK nuevo:** instalar o actualizar una dependencia nativa (`expo-camera`, `react-native-*`…), cambiar permisos o plugins en `app.json`, cambiar `package`, icono, nombre, `runtimeVersion`, versión del SDK de Expo.
**Qué no se empaqueta nunca en la app:** backend y base de datos. Los cambios en microservicios, Kong o esquemas (Liquibase) viven en el servidor: se despliegan con el pipeline de la Parte I y la app los ve al instante porque consulta la misma URL. La URL del backend sí está dentro del APK (`EXPO_PUBLIC_API_URL`): cambiarla requiere **APK nuevo**, no OTA.

**Preparación única (ya hecha en el repo):** `expo-updates` instalado, `updates.url` y `extra.eas.projectId` en `app.json` (proyecto `@jonas7891/faceattend-edu`), `updates.enabled` retirado y `runtimeVersion.policy: "appVersion"`. El **APK que se compile a partir de ahora** ya recibe OTA; los APK anteriores (sin `expo-updates`) hay que reinstalarlos una vez.

**Flujo diario (un comando):** cambia el código, haz commit y, desde `front-end/Mobile`:
```powershell
npm run update                       # publica al canal production con el asunto del último commit
npm run update -- "mensaje propio"   # o con tu propio mensaje (el script lo toma tras el canal)
npm run update:preview               # prueba primero en el canal preview
```
El script (`scripts/publish-update.js`) ejecuta `eas update --channel <canal> --message … --non-interactive`. Requiere sesión iniciada (`eas login`) o `EXPO_TOKEN`.

**Canales y ramas** (ya definidos en `eas.json`):

| Perfil de build | Canal | Rama de actualización recomendada | Uso |
|---|---|---|---|
| `development` | `development` | `development` | desarrollo |
| `preview` | `preview` | `preview` | pruebas con el equipo / QA |
| `production` | `production` | `production` | usuarios finales |

Publicar (cada vez que cambie solo JavaScript/assets):
```powershell
eas update --channel preview --message "fix: texto del login"      # primero a pruebas
eas update --channel production --message "fix: texto del login"   # luego a producción
eas channel:list          # canales y la rama a la que apuntan
eas update:list --branch production     # historial de actualizaciones publicadas
```
Si un canal apunta a otra rama: `eas channel:edit production --branch production`. Para revertir: `eas update:republish` de una actualización anterior.

**Propagación desde el repositorio (opcional, no existe en el repo):** un workflow de GitHub Actions que ejecute `eas update --channel production --non-interactive` al hacer push a `main` solo si cambió `front-end/Mobile/**`. Necesita el secreto `EXPO_TOKEN` (**Supuesto:** el equipo lo crea en expo.dev → Access tokens y lo guarda en GitHub Secrets; nunca en el repo).

## 15. URL del backend según el entorno

La app habla **solo con Kong** (nunca con la base de datos). `src/config/env.js` resuelve la URL en este orden: `EXPO_PUBLIC_API_URL` → `hostUri` de Expo → `debuggerHost` → `10.0.2.2` (solo emulador) → `192.168.1.3`. En un APK instalado no hay `hostUri`: **sin `EXPO_PUBLIC_API_URL` la app apunta a `10.0.2.2` y no conecta en un teléfono real**.

| Entorno | Perfil | `EXPO_PUBLIC_API_URL` | Notas |
|---|---|---|---|
| Desarrollo (Expo Go / dev client) | `development` | `http://<IP-LAN-del-PC>:8000` | `http://localhost:8000` (valor actual) solo sirve en emulador con `adb reverse tcp:8000 tcp:8000` |
| Pruebas | `preview` | `https://faceattend-edu.duckdns.org` | dominio de producción (única instancia; no hay staging) |
| Producción | `production` | `https://faceattend-edu.duckdns.org` | Caddy termina TLS y reenvía a Kong `:8000` (`Caddyfile.prod`) |

Producción solo responde por `https://faceattend-edu.duckdns.org` (Caddy, puertos 80/443); el puerto 8000 de Kong ya no es accesible desde Internet (§2). La raíz `/` responde 404 porque ese dominio es solo la API (el sitio web vive en Vercel). **Supuesto:** el equipo mantiene ese dominio apuntando a la instancia EC2; el nombre `ec2-…amazonaws.com` no es estable (cambia si se detiene la instancia).

Cómo se inyecta: EAS **no sube `.env`** (está en `.gitignore`), por eso la URL va en el bloque `env` de cada perfil de `eas.json`. Para un build local con Gradle se usa `front-end/Mobile/.env`.

### Permisos de red y cámara
- **HTTP en claro:** `usesCleartextTraffic: true` sigue en `app.json` (necesario solo para desarrollo en LAN con `http://`). Con el dominio HTTPS no se usa; retirarlo en producción es una mejora pendiente (cambio nativo → APK nuevo).
- **Cámara:** el plugin `expo-camera` añade `CAMERA` al manifiesto; el permiso se pide en ejecución al abrir *Registro facial*. Si se niega: *Ajustes → Apps → FaceAttend EDU → Permisos*.
- **HTTPS:** el certificado debe ser válido (Let's Encrypt vía Caddy). Android rechaza certificados autofirmados.

## 16. Generar el APK con EAS Build

Todos los comandos, en `front-end\Mobile`.

### 16.1 Verificación previa
```powershell
npx expo-doctor                           # dependencias incompatibles con el SDK
eas whoami
eas config -p android --profile preview   # perfil resuelto: buildType=apk, channel y URL
```
La URL resuelta debe ser `https://faceattend-edu.duckdns.org` y no contener `CHANGE_ME` ni `localhost`.

### 16.2 APK de pruebas (`preview`, distribución interna)
```powershell
eas build --platform android --profile preview
```
Sube el proyecto, compila en la nube y al terminar imprime un enlace y un QR. La primera vez pregunta por la keystore: ver 14.1.

### 16.3 APK de release firmado (`production`)
```powershell
eas build --platform android --profile production
```
Usa la keystore gestionada por EAS y `autoIncrement` sube el `versionCode`. Para Google Play (no es el caso aquí) se cambia `buildType` a `app-bundle`.

### 16.4 Seguir el estado y descargar
- Terminal: `eas build:list` y `eas build:view`.
- Web: https://expo.dev → proyecto → *Builds* (*In queue → In progress → Finished / Errored*; el log completo está en cada build).
- Al terminar, el botón **Install / Download** (o el enlace/QR) entrega el `.apk`. Descárgalo y guárdalo: los enlaces de distribución interna caducan.

## 17. Instalar y probar el APK

1. **Teléfono, sin cables:** abre el enlace de EAS en el navegador del teléfono, descarga el `.apk` y ábrelo. Android pedirá *Instalar apps desconocidas* para la app con la que lo abriste: acéptalo solo para esa app.
2. **Con cable (adb):** activa *Opciones de desarrollador → Depuración por USB* y:
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\faceattend-edu.apk
   ```
3. **Emulador:** arrastra el `.apk` a la ventana.
4. Antes de abrir la app, desde el navegador del teléfono: `https://faceattend-edu.duckdns.org/api/v1/persons` debe mostrar un JSON con `"status":401` (el gateway responde y exige sesión). Si no carga, la app tampoco conectará.
5. **Comprobar que el dispositivo tiene la última versión publicada:**
   - **APK:** *Ajustes → Apps → FaceAttend EDU* muestra `versionName` (= `version` de `app.json`); `versionCode` sube con cada build `production` (`eas build:list`).
   - **OTA** (tras 14.3): abre la app, ciérrala por completo y ábrela de nuevo (la actualización se descarga al abrir y se aplica al siguiente arranque). `eas update:list --branch <canal>` muestra el *Update ID* publicado; compara con el que informa el dispositivo (**Supuesto:** el equipo muestra `Updates.updateId` de `expo-updates` en una pantalla de ajustes; el repo no lo hace hoy). Alternativa sin código: tras publicar, cambia un texto visible de la app y verifica que aparece.

## 18. Errores frecuentes en EAS

| Síntoma | Causa probable | Solución |
|---|---|---|
| El build entrega un `.aab` | Falta `android.buildType: "apk"` en el perfil | Ya está en `preview` y `production`; revisa `eas config` |
| Login con "error de red" | URL `CHANGE_ME_*`, `localhost` o `10.0.2.2` grabada, o dominio caído | Corregir `env` del perfil y **recompilar** (un `.env` local no afecta a EAS); probar `/api/v1/persons` (debe responder 401) |
| Funciona en el navegador, falla en la app con HTTPS | Certificado no emitido o inválido | `docker logs` del contenedor Caddy; puertos 80/443 abiertos |
| `Project not found` / pide `projectId` | No se ejecutó `eas init` o la cuenta no es la del proyecto | 14.1 |
| `Invalid UUID appId` / `slug` no coincide | `slug` o propietario distintos al proyecto en Expo | No cambiar `slug`; `eas project:info` |
| Falla *Install dependencies* | `package-lock.json` desincronizado | `npm install`, commit del lockfile |
| Falla *Run gradlew* en una librería nativa | Versión incompatible con el SDK | `npx expo install --check`, `npx expo-doctor`; leer el log del build |
| Credenciales / keystore | Keystore ausente o de otro proyecto | `eas credentials -p android`; no generar una nueva si ya hay APK distribuidos |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Hay instalada una versión firmada con otra llave (p. ej. compilación local) | Desinstalar e instalar |
| `eas update` publica pero el dispositivo no cambia | Falta `expo-updates` / `updates.enabled:false` (14.3); canal distinto al del APK; `runtimeVersion` distinto | `eas channel:list`; publicar al canal del perfil con el que se compiló; mismo `version` en `app.json` |
| `No runtime version` / "incompatible runtime" | La actualización se publicó con otra `runtimeVersion` (cambió `version` o una dependencia nativa) | Generar un APK nuevo con la versión actual y volver a publicar |
| Registro facial: 408 | Subida lenta de 18 fotogramas; ms-biometric tarda en frío | La app espera 60 s y Kong 60 s; reintentar con buena luz y Wi-Fi estable |
| 401 tras un rato | Sesión vencida (la app la renueva tras 1 h) | Volver a iniciar sesión |
| 429 en biometría | Más de 20 intentos/60 s (`BIOMETRIC_RATE_LIMIT_MAX_ATTEMPTS`) o 300/min en Kong | Esperar un minuto |

## 19. Validación de persistencia de extremo a extremo

### 19.1 Cadena (verificada en código y con una prueba real)
```
APK ──HTTPS──▶ Caddy ──▶ Kong :8000 ──▶ ms-identity (valida Bearer contra /api/v1/sessions/{id})
                                  └─▶ ms-biometric :8086 ──▶ MongoDB faceattend_biometric.facial_embeddings
Web (Vercel) ──▶ Kong ──▶ ms-biometric (GET /api/v1/biometric/{personId}/summary)
Web (Vercel) ──▶ Kong ──▶ ms-attendance :8085 ──▶ PostgreSQL (Neon) attendance.attendance_record
```

### 19.2 Endpoints, modelos y campos
La app envía **JSON con imágenes en base64** (`data:image/jpeg;base64,…`), **no multipart**. Cabeceras: `Content-Type: application/json`, `Authorization: Bearer <sessionId>`. Timeout de la app para biometría: 60 s (15 s para el resto). Manejo de errores: `AbortError` → 408; fallo de red → `ApiError(0)` con la URL en el mensaje; 401 fuera de `/auth/` → cierra sesión.

| # | Llamada | Cuerpo / parámetros | Respuesta | Persistencia |
|---|---|---|---|---|
| 1 | `POST /api/v1/auth/login` | `{identifier, password}` | `{sessionId, userId, …}` | sesión en identity |
| 2 | `GET /api/v1/biometric/facial/liveness-challenge?actions=3` | — | `{challenge_token, actions}` | — (token firmado con `BIOMETRIC_LIVENESS_CHALLENGE_SECRET`, TTL 120 s) |
| 3 | `POST /api/v1/biometric/facial/liveness-step` (×3) | `{challenge_token, action_index, images[6]}` (6 fotogramas exactos) | `{challenge_token, completed}` | — (cada paso devuelve un token nuevo) |
| 4 | `POST /api/v1/biometric/facial/enroll-image` | `{person_id, image_base64, challenge_token}` (con el **último** token) | `201` | MongoDB `facial_embeddings`, clave `person_id` |
| 5 | `GET /api/v1/biometric/{personId}/summary` | — | `{person_id, has_face, has_fingerprint}` | lectura |
| 6 | `POST /api/v1/biometric/facial/identify-image` | `{image_base64, challenge_token}` (personal) | `{person_id, score}` | lectura (1:N) |
| 7 | `POST /api/v1/attendance-records` | `{classSessionId, academicActorId, attendanceStatus, captureMethod, matchScore?}` | 201 / 409 si ya existe | `attendance.attendance_record` (único por sesión + actor) |
| 8 | `GET /api/v1/attendance-records?classSessionId=&academicActorId=&attendanceStatus=&limit=&offset=` | — | listado | lo que muestra la web |

Valores válidos: `attendanceStatus ∈ {Present, Absent, Late, Justified}`; `captureMethod ∈ {FACIAL, MANUAL, FINGERPRINT, IMPORT}`. Límite de imagen: `BIOMETRIC_MAX_IMAGE_BYTES` = 3 MiB (≈4 MiB en base64). Un estudiante solo puede inscribir su propio `person_id`; reemplazar una plantilla exige un caso de actualización biométrica *Approved*; un rostro ya inscrito en otra persona devuelve 409.

### 19.3 Prueba real realizada
En un entorno local con el mismo código (no contra producción), 2026-10-19: inscripción con imagen de 640 px/JPEG q60 → **201**; el vector quedó en MongoDB; `summary` → `has_face: true`; `identify-image` con otras dos capturas (800 px/q80 y 480 px/q50) devolvió la misma persona con puntajes **0.998 y 0.999** (umbral 0.85); un `POST /attendance-records` con `captureMethod=FACIAL` devolvió 201 y el `GET` lo listó. Límite: se usó una foto fija, no la cámara ni los gestos de vivacidad reales.

### 19.4 Hallazgos

1. **Registrar un rostro no crea asistencia por sí solo, y es el diseño actual.** `ms-biometric` no emite eventos ni llama a `ms-attendance`; `ms-attendance` no consume eventos biométricos. La app móvil solo inscribe (la única pantalla con cámara es `RegisterFace`); la identificación (`identify-image`) y el alta de asistencia las hace el personal desde la web (quiosco). El objetivo "registrar rostro → aparece asistencia" se cumple en dos tramos: **A** (móvil → MongoDB → estado biométrico en web) y **B** (web/docente → PostgreSQL → web). Si se quisiera automático, sería funcionalidad nueva (decisión del equipo).
2. **`summary` exige `attendance.record:write`** (`summary_router.py`): un aprendiz recibiría 403 al consultar su propio estado. No afecta a la app actual (solo `UserDetail`, usada por personal). Corrección sugerida: permitir lectura del propio `person_id` con `biometric.case:request`.
3. **`identify-image` solo para personal** (`attendance.record:write`): coherente con el quiosco; un aprendiz no puede autoidentificarse.
4. **Ruta heredada:** `LEGACY_ENDPOINT_MAP['face/register']` (`src/api/apiClient.js`) apunta a `/facial/enroll` (requiere vector y permiso de personal). La pantalla actual usa `enroll-image`; no usar esa ruta.
5. **Fotograma de inscripción:** se enrola el fotograma central de los 18 capturados (`frames[floor(len/2)]`), que cae a mitad de un gesto (parpadeo, giro, boca abierta). Con una foto neutra el reconocimiento fue 0.998; con la cara real en pleno gesto podría bajar. **Sin verificar en dispositivo.** Si el quiosco no te reconoce, probar a inscribir un fotograma neutro.
6. **OTA no operativa hoy:** falta `expo-updates`, `projectId` y `updates.url`, y `updates.enabled` es `false` (14.3).
7. **Host de la instancia:** el nombre `ec2-…amazonaws.com` cambia si se detiene la instancia; el dominio estable es `faceattend-edu.duckdns.org`. Usa siempre el dominio.
8. **`newArchEnabled: false`** en `app.json` con RN 0.86 y `react-native-reanimated 4` (que exige la arquitectura nueva): el APK compila, pero no se ha ejecutado en dispositivo. Verificar al probar.

### 19.5 Supuestos explícitos
- Cuenta/organización de Expo, `projectId`, `EXPO_TOKEN` y keystore existente: los aporta el equipo (el repo no los contiene).
- Usuarios y contraseñas de prueba: Tabla 19 del Manual de Instalación (carpeta RAPS). No se escriben aquí.
- Debe existir una `person` con permiso para inscribirse (el propio aprendiz, o docente/administrador), una sesión de clase y un actor académico matriculado (`tools/seed-api-test-data`, `npm run seed`, solo en entornos de prueba).
- Nombres de contenedor: PostgreSQL local `faceattend-postgres`; MongoDB `faceattend-mongo`. En producción la base SQL es Neon (se consulta con `psql` y la cadena de conexión de `.env.prod`).
- Versión mínima de Android y versión exacta de Node: no definidas en el repo.

## 20. Checklist de verificación paso a paso

Marca cada punto en orden; si uno falla, no avances.

**A. Vinculación con Expo**
- [ ] 20.1 `eas whoami` muestra la cuenta/organización del equipo.
- [ ] 20.2 `eas project:info`: `slug` = `faceattend-edu` y el `projectId` coincide con `app.json → expo.extra.eas.projectId`.
- [ ] 20.3 `eas credentials -p android` lista la keystore ya establecida (misma huella SHA-1 que los APK distribuidos).
- [ ] 20.4 (Expo Go) `npx expo start` abre la app en el teléfono; o se usa un *development build*.

**B. Build y APK**
- [ ] 20.5 `eas config -p android --profile <perfil>`: `buildType=apk`, canal correcto y URL `https://faceattend-edu.duckdns.org`.
- [ ] 20.6 `eas build -p android --profile <perfil>` termina en *Finished* en expo.dev.
- [ ] 20.7 Se descargó un `.apk` (no `.aab`) y se guardó una copia.
- [ ] 20.8 El APK se instaló y abre con el nombre **FaceAttend EDU** y el icono correcto.

**C. Actualización OTA** (solo después de 14.3 y de un APK con `expo-updates`)
- [ ] 20.9 `eas channel:list` muestra el canal del perfil apuntando a su rama.
- [ ] 20.10 Se cambió un texto en la app, se hizo commit en el repositorio y `eas update --channel <canal> --message "…"` terminó bien.
- [ ] 20.11 `eas update:list --branch <canal>` muestra la actualización.
- [ ] 20.12 En el teléfono: cerrar la app por completo y abrirla dos veces; el texto nuevo aparece **sin reinstalar**.
- [ ] 20.13 Un cambio nativo (p. ej. un permiso) **no** llega por OTA: requiere repetir 20.6–20.8.

**D. Conexión al backend**
- [ ] 20.14 Desde el navegador del teléfono: `https://faceattend-edu.duckdns.org/api/v1/persons` devuelve JSON con `status` 401.
- [ ] 20.15 Login en la app con un usuario de prueba entra al panel. Equivalente desde el PC:
  ```powershell
  curl.exe -s -X POST https://faceattend-edu.duckdns.org/api/v1/auth/login -H "Content-Type: application/json" -d "{\"identifier\":\"<usuario>\",\"password\":\"<clave>\"}"
  ```
  Debe devolver un `sessionId`.

**E. Tramo A — registro de rostro**
- [ ] 20.16 *Registro facial* → conceder cámara → completar los 3 gestos → mensaje de éxito.
- [ ] 20.17 En el servidor, los logs de `ms-biometric` muestran `POST /api/v1/biometric/facial/enroll-image` con **201**.
- [ ] 20.18 El vector existe en MongoDB (esperado `1` activo por persona):
  ```bash
  docker exec -it faceattend-mongo mongosh -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin faceattend_biometric --eval 'db.facial_embeddings.countDocuments({person_id: "<person_id>"})'
  ```
- [ ] 20.19 Con rol de personal, `GET /api/v1/biometric/<person_id>/summary` → 200 con `has_face: true`; la web lo muestra como inscrito.

**F. Tramo B — asistencia**
- [ ] 20.20 Registrar la asistencia (quiosco web / docente) o por API (esperado 201; 409 si ya existía):
  ```bash
  curl -s -X POST https://faceattend-edu.duckdns.org/api/v1/attendance-records -H "Authorization: Bearer <sessionId>" -H "Content-Type: application/json" \
    -d '{"classSessionId":<id>,"academicActorId":<id>,"attendanceStatus":"Present","captureMethod":"FACIAL"}'
  ```
- [ ] 20.21 El registro existe en PostgreSQL (si los nombres de columna difieren: `\d attendance.attendance_record`):
  ```sql
  SELECT * FROM attendance.attendance_record ORDER BY 1 DESC LIMIT 5;
  ```
- [ ] 20.22 La web lista ese registro en la asistencia de la sesión/estudiante y el móvil lo muestra en su historial.
- [ ] 20.23 Persistencia tras reinicio: reiniciar el contenedor `ms-attendance` y comprobar que el registro sigue visible.

**G. Cierre**
- [ ] 20.24 Guardar evidencias: build *Finished* en EAS, 201 en logs, fila en Mongo/PostgreSQL, pantalla web.
