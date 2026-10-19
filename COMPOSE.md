# FaceAttend EDU — Docker Compose y redes

Referencia única de la infraestructura Docker: qué compone cada archivo, cómo se
conectan los contenedores entre sí, qué puertos se publican y qué variables se
interpolan. Todo se lanza desde la raíz del repositorio (`FULL/`).

```bash
docker compose up -d --build      # todo el stack
docker compose down               # para todo (conserva los volúmenes de datos)
```

---

## 1. Cómo está dividido

Cada carpeta es dueña de una capa y aporta su archivo `docker-compose.yml`; la
raíz solo orquesta.

| Carpeta | Capa | Aporta al stack |
|---|---|---|
| `database/` | **Datos** | `postgres` (única instancia) + 8 migraciones Liquibase (una por bounded context) + `database-init/` (crea los 8 schemas en el primer arranque) |
| `back-end/` | **Aplicación** | 9 microservicios (`ms-identity` … `ms-quality`, `ms-biometric` incluye biometría web, §9) + `kong-gateway` + `mongodb`, `redis`, `kafka` |
| `front-end/Web/` | **Presentación** | servicio `frontend-web` (Expo export → nginx), definido en el compose raíz porque es una preocupación de presentación |
| raíz (`FULL/`) | **Orquestación** | `docker-compose.yml` (incluye los dos de arriba y encadena todo), `.env` / `.env.example` |

### Archivos compose

| Archivo | Define | ¿Se puede correr solo? |
|---|---|---|
| `docker-compose.yml` (raíz) | `include` de `database/` y `back-end/`; servicio `frontend-web`; **cadena de dependencias** de los 8 Liquibase y de los 9 microservicios; red `faceattend-edge` | ✅ es el entrypoint oficial |
| `database/docker-compose.yml` | `postgres` + 8 servicios `*-liquibase`, volumen `postgres_data`, red `faceattend-data` | ✅ `cd database && docker compose up -d` |
| `back-end/docker-compose.yml` | `mongodb`, `redis`, `kafka`, 9 `ms-*`, `kong-gateway` | ❌ **no**: `ms-*` declaran `depends_on: postgres`, que vive en `database/`. Correrlo solo falla con `service "ms-identity" depends on undefined service "postgres"` (error intencional y claro) |
| `back-end/99-api-gateway/docker-compose.yml` | solo `kong`, con las mismas variables/puertos que la definición canónica | ✅ solo para reiniciar Kong contra un stack ya levantado. Usa redes `external: true`; no levántelo a la vez que `kong-gateway` (chocan por nombre y puerto) |
| `database/0X-ms-*-db/docker-compose.yml` (8) | un servicio `liquibase` que migra **ese** contexto contra `host.docker.internal:5432` | ✅ para migrar un bounded context aislado, sin subir todo el stack |

> **Regla:** `postgres` está definido **una sola vez**, en `database/`. Si alguien
> lo duplica en `back-end/`, los dos `include` compiten y la semántica de "quién
> gana" deja de ser explícita.

---

## 2. Orden de arranque

La cadena vive en `docker-compose.yml` (raíz). Servicio por servicio:

1. `postgres` → `service_healthy`
2. Liquibase **en serie**, cada uno espera al anterior con
   `service_completed_successfully`:
   `identity → authorization → academic → scheduling → attendance → biometric → configuration → notification`
3. Cada `ms-X` espera **`postgres` healthy** + **su propio `X-liquibase` completado**.
   `ms-quality` no tiene changelog propio, así que espera `notification-liquibase`
   (arranca recién con toda la base migrada).
4. `kong-gateway` espera `redis`, `kafka` y los 8 microservicios principales
   `healthy`.
5. `frontend-web` espera `kong-gateway` `healthy`.

Validar el modelo resultante sin levantar nada:

```bash
docker compose config            # render completo
docker compose config --services # lista de servicios
```

---

## 3. Las tres redes

Tres puentes, uno por capa, de modo que **la capa de datos es inalcanzable desde
la red que ve el navegador**:

| Red | Miembros | Propósito | Lo que NO resuelve |
|---|---|---|---|
| `faceattend-edge` | `frontend-web`, `kong-gateway` | único punto de contacto con el exterior; el nginx de `frontend-web` hace proxy de `/api/*` a Kong | `postgres`, `mongodb`, `kafka`, `ms-*` |
| `faceattend-app` | `kong-gateway`, 9 `ms-*`, `redis` | upstreams de Kong (`ms-*:8081-8089`), llamadas entre microservicios (auth) y rate-limit de Kong en Redis | `postgres`, `mongodb`, `kafka` |
| `faceattend-data` | 9 `ms-*`, `postgres`, `mongodb`, `kafka`, 8 `*-liquibase` | JDBC/Mongo/Kafka de los servicios + ejecución de las migraciones | no participa en `edge` |

```
        ┌──────────────────────────── host ─────────────────────────────┐
        │   navegador ──8090──► frontend-web (nginx)                    │
        │        │                      │  /api/* (red edge)           │
        │        │8000 (red edge)       ▼                              │
        │        └──────────────► kong-gateway ──► redis                │
        │                            │            (red app)            │
        │                            └──► ms-identity … ms-quality     │
        │                                 8081-8089 (loopback)         │
        │                                      │ (red data)            │
        │                                      ▼                       │
        │                    postgres · mongodb · kafka · liquibase    │
        └──────────────────────────────────────────────────────────────┘
```

Comprobación rápida (Kong y el frontend deben fallar resolviendo las bases de
datos):

```bash
docker network inspect full_faceattend-edge --format '{{range .Containers}}{{.Name}} {{end}}'
docker exec faceattend-frontend-web nslookup postgres        # *** Can't find postgres
docker exec faceattend-kong getent hosts postgres            # debe fallar
docker exec faceattend-kong getent hosts ms-identity         # debe resolver
```

> Los nombres de red se prefijan con el nombre del proyecto: el compose raíz
> crea `full_faceattend-*`. Ejecutar `database/` aislado crea
> `database_faceattend-data` (otro proyecto, otras redes).

---

## 4. Puertos publicados

Dos puertos quedan abiertos al mundo (`0.0.0.0`); el resto está en loopback
(`BIND_IP`, por defecto `127.0.0.1`), accesibles desde esta máquina pero
invisibles para el resto de la LAN:

| Puerto | Servicio | Bind | Motivo |
|---|---|---|---|
| **8000** | `kong-gateway` (proxy) | `0.0.0.0` | el navegador y un celular en la LAN consumen la API |
| **8090** | `frontend-web` | `0.0.0.0` | el navegador (y un celular) cargan el SPA |
| 8001 | `kong-gateway` (admin) | `BIND_IP` | administración local |
| 5432 / 27017 / 6379 / 9092 | postgres / mongodb / redis / kafka | `BIND_IP` | bases y broker: nunca exponerlos |
| 8081–8089 | los 9 microservicios (`ms-biometric` 8086 incluye biometría web) | `BIND_IP` | solo los consume Kong (y el IDE/curl locales) |

Cambiar el perímetro sin tocar los compose: `BIND_IP=0.0.0.0` en `.env` (útil
para depurar desde otro equipo o probar desde el celular) y volver a
`127.0.0.1` después. Verificar con:

```bash
docker ps --format "{{.Names}} | {{.Ports}}"
```

> Para probar desde el celular además hace falta
> `EXPO_PUBLIC_API_URL=http://<IP-de-la-PC>:8000` y **reconstruir** el frontend
> (la URL se hornea en el bundle en tiempo de build). Kong permite CORS en
> `http://localhost:3000`, `:5173` y `:8090`; agrega la IP de la PC en
> `back-end/99-api-gateway/kong/kong.yml` si vas a servirla desde otro origen.

---

## 5. Variables de entorno (un solo `.env`)

Compose lee **un único** archivo `.env`, y solo del **directorio del proyecto**
(donde se ejecuta `docker compose`). No sube directorios y no hay ningún
`env_file:` declarado en los compose.

| Archivo | Estado | Uso |
|---|---|---|
| `.env.example` (raíz) | trackeado | plantilla documentada: cópialo a `.env` |
| `.env` (raíz) | **local**, ignorado por `.gitignore` | lo que usa todo el stack al correr desde `FULL/` |
| `database/.env*` | **no existen** | `database/` corre con los `${VAR:-default}` de su compose |

Todos los compose usan valores por defecto (`${POSTGRES_USER:-postgres}`), así
que **cualquier corrida funciona sin `.env`**; el archivo solo sirve para
sobrescribir puertos, credenciales o la imagen de Liquibase.

Si personalizas valores en la raíz y quieres que una corrida aislada de
`database/` los use, indícaselo explícitamente:

```bash
cd database && docker compose --env-file ../.env up -d
```

### Fuera de Docker

Los servicios que corren en la estación de trabajo **leen este mismo `.env`** al
arrancar — no lo hace Compose, lo hace cada servicio:

| Servicio | Mecanismo |
|---|---|
| `01-ms-identity`, `02-ms-authorization`, `04-ms-scheduling`, `05-ms-attendance` | `spring.config.import` con rutas `optional:file:${user.dir}/…` |
| `03-ms-academic`, `09-ms-quality` | `process.loadEnvFile('../../.env')` al cargar su módulo de BD (y `drizzle.config.ts`) |
| `06-ms-biometric` | `_load_root_env()` en `settings.py` (sin dependencias; nunca pisa el entorno real) |

Las rutas parten del **directorio de trabajo**: el del servicio
(`back-end/0X-…`) o la raíz del repo. En Docker el archivo no existe dentro de
la imagen y compose ya inyecta el entorno, así que todo queda en **no-op**.
Los defaults dev (`postgres`, `mongopass`) siguen siendo el último recurso: sin
`.env`, todo arranca igual que siempre.

Variables principales (ver `.env.example`): `POSTGRES_*`, `FACEATTEND_LIQUIBASE_IMAGE`,
`MONGO_*`, `REDIS_PORT`, `KAFKA_PORT`, `KONG_PROXY_PORT`, `KONG_ADMIN_PORT`,
`FRONTEND_PORT`, `EXPO_PUBLIC_API_URL`, `BIND_IP`, `SEED_*`.

---

## 6. Datos persistentes

| Volumen | Contenido |
|---|---|
| `postgres_data` | `faceattend_db` (8 schemas, migraciones Liquibase) |
| `mongo_data` | embeddings biométricos y plantillas de la pantalla Biometría, todo en `faceattend_biometric` |
| `redis_data` | rate-limit / caché de Kong |
| `kafka_data` | topics de eventos |

- `database/database-init/01-init-schemas.sql` se ejecuta **solo en el primer
  arranque** (cuando `postgres_data` está vacío): crea los 8 schemas.
- `docker compose down` **no** borra volúmenes. `docker compose down -v` sí
  borra los datos: solo con intención.

---

## 7. Comandos de uso

```bash
docker compose up -d --build          # arrancar todo (raíz)
docker compose up -d                  # recrear con las imágenes ya construidas
docker compose ps                     # estado + salud
docker compose logs -f ms-identity    # logs de un servicio
docker compose down                   # parar conservando datos
docker compose config                 # validar el modelo (1 = error)

cd database && docker compose up -d                    # solo datos + migraciones
cd back-end/99-api-gateway && docker compose up -d     # solo Kong (stack ya creado)
cd database/01-ms-identity-db && docker compose up liquibase   # un contexto
```

---

## 8. Problemas conocidos

| Síntoma | Causa / solución |
|---|---|
| `service "ms-…" depends on undefined service "postgres"` | se corrió `back-end/docker-compose.yml` aislado. Levanta desde la raíz |
| `frontend-web` queda `unhealthy` | el healthcheck debe usar `127.0.0.1`; nginx solo escucha IPv4 y `localhost` resuelve también a `::1`, que rechaza la conexión |
| `port is already allocated` al usar 8082 para el frontend | 8082 es `ms-authorization`; el frontend va en **8090** |
| `502` de Kong | el microservicio upstream no está `healthy` aún; revisa `docker compose ps` y `docker compose logs <ms>` |
| El navegador no conecta con la API | `EXPO_PUBLIC_API_URL` se hornea en el build; cambia `.env` y vuelve a `docker compose up -d --build frontend-web` |
| Biometría: `401 Missing or invalid bearer token` en `/api/v1/biometric/*` | `ms-biometric` valida la sesión contra `ms-identity` (la pantalla va dentro del dashboard); inicia sesión primero |
| Biometría: «La cámara no está disponible» / permiso denegado | `getUserMedia` solo funciona en `localhost` o por **HTTPS**; en remoto sirve el frontend y Kong por HTTPS |
| Biometría: «Runtime DigitalPersona no detectado» | falta el runtime del lector **en el equipo del usuario** (§9); no es un fallo del stack |
| Cambié `kong.yml` y no surte efecto | Kong DB-less lee el archivo al arrancar: `docker compose restart kong-gateway` |
| Redes duplicadas viejas (`back-end_*`, `full_*`) | proyectos abandonados; `docker compose down` en cada carpeta y `docker network rm <red>` (los volúmenes quedan intactos) |

---

## 9. Biometría web (rostro + huella)

Capacidad integrada en **`ms-biometric`** (`back-end/06-ms-biometric/`, FastAPI +
OpenCV/dlib) — originalmente un servicio aparte (`face-auth-api`, basado en
[face-auth](https://github.com/Jonas7891/face-auth)), fusionado en `ms-biometric`
para que todo lo biométrico viva en un solo servicio. Cubre **registro de
rostro**, **reconocimiento facial** y **registro/reconocimiento de huella**, más
el almacenamiento vectorial que `ms-biometric` ya tenía.

| Pieza | Dónde | Notas |
|---|---|---|
| `ms-biometric` | `back-end/06-ms-biometric/` (FastAPI + OpenCV/dlib) | arranca con `docker compose up -d --build`; la primera build compila dlib (varios minutos) |
| MongoDB | contenedor `mongodb` compartido | base `faceattend_biometric` (`facial_embeddings`, `fingerprint_embeddings`, auditoría) |
| Ruta Kong | `kong.yml` → `biometric-service` | `/api/v1/biometric/*` → `ms-biometric:8086/*` (`strip_path: false`); autenticación/RBAC los hace el propio servicio (`require_permission`), no Kong |
| Pantalla web | `/app/biometrics/:section` | `face-register` · `face-login` · `fingerprint`; se abre con **«Tomar asistencia»** en Inicio (sin item en la sidebar), solo **admin y profesor** (`canRegisterFace`) |

Misma configuración en local y en remoto: el frontend llama a
`EXPO_PUBLIC_API_URL + /api/v1/biometric/...` con el Bearer de la sesión. Para
remoto:

1. `EXPO_PUBLIC_API_URL=https://<host-de-kong>` y reconstruir el frontend.
2. Añadir el origen del frontend a `cors.origins` en `kong.yml` y
   `docker compose restart kong-gateway`.
3. Servir **frontend y Kong por HTTPS**: el navegador solo concede la cámara en
   `localhost` o HTTPS.
4. Producción: definir `BIOMETRIC_LIVENESS_CHALLENGE_SECRET` (≥ 32 caracteres
   aleatorios) en `.env` — firma los retos de prueba de vida, no una sesión.

**Lector de huella (DigitalPersona 4500).** El SDK web habla con el *runtime*
DigitalPersona instalado **en el equipo donde está el lector** (driver + runtime
oficial); no corre en Docker ni en el servidor, y un lector USB de otro equipo no
es accesible por red. Los scripts del SDK se copian a `/vendor` en el build
(`scripts/copy-digitalpersona.mjs`). Sin runtime, la pantalla lo indica y sigue
sondeando cada 3 s mientras el módulo está abierto.

**Prueba de vida.** El registro pide 3 gestos y el reconocimiento 2 (parpadear,
girar la cabeza, abrir la boca), validados en el servidor. Es una defensa básica,
no un anti-spoofing certificado.

---

## 10. TLS / HTTPS (opcional)

El compose base sirve todo en HTTP plano (8000/8090); no hay nada que termine
TLS por defecto. `docker-compose.tls.yml` agrega un Caddy delante de
`kong-gateway` y `frontend-web` sin tocar el compose base:

```bash
# DOMAIN real con DNS -> este host (y api.<DOMAIN> para Mobile): Let's Encrypt
# automático. Sin DOMAIN: certificado de la CA local de Caddy (solo para probar
# el flujo HTTPS, el navegador lo marca como no confiable).
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

Los puertos 8000/8090 en HTTP siguen publicados en paralelo (no se tocó el
compose base) para no romper el flujo de desarrollo actual; para forzar
solo-HTTPS en un despliegue real, quita esas dos líneas `ports:` una vez que
Caddy esté validado. Mobile debe apuntar `EXPO_PUBLIC_API_URL` a
`https://api.<DOMAIN>`; Web, a `https://<DOMAIN>` (nginx ya hace de `/api/*`
hacia Kong internamente, ver `front-end/Web/nginx.conf`).

---

## 11. Backups

No hay backup/retención automático: `docker compose down -v` borra los
volúmenes sin preguntar dos veces. `database/scripts/backup.sh` vuelca las 2
bases (`faceattend_db`, MongoDB) a `database/backups/<timestamp>/`
(gitignored); `database/scripts/restore.sh <carpeta>` las restaura. Ninguno de
los dos programa nada — hoy es manual; en un despliegue real, llama a
`backup.sh` desde un cron del host o del orquestador.
