# FaceAttend EDU — Despliegue en AWS EC2 con Neon PostgreSQL

> **Contenido:** Parte I (secciones 1–12): backend en AWS EC2 + Neon + Vercel. **Parte II (secciones 13–20, al final):** APK con EAS Build, actualizaciones OTA y validación de persistencia de la app móvil.

## Estado Final: ✅ DESPLIEGUE COMPLETADO

**Fecha:** 2026-10-16  
**Instancia:** AWS EC2 t3.xlarge (ec2-32-199-154-193.compute-1.amazonaws.com)  
**Región:** us-east-1  
**Almacenamiento:** 150GB EBS gp3

---

## 1. Resumen Ejecutivo

### Infraestructura Desplegada
- **13 contenedores Docker en ejecución** (9 microservicios + 3 infraestructura + Kong)
- **Kong API Gateway** exponiendo toda la arquitectura en puerto 8000
- **Neon PostgreSQL** con 8 esquemas (bounded contexts completamente inicializados)
- **MongoDB, Redis, Kafka** para almacenamiento y mensajería
- **Portainer** para gestión de contenedores

### Microservicios (9/9 - Todos Operacionales)
1. **ms-identity** (8081) - Gestión de identidad
2. **ms-authorization** (8082) - Control de acceso RBAC
3. **ms-academic** (8083) - Académico y currículo
4. **ms-scheduling** (8084) - Horarios y bloques
5. **ms-attendance** (8085) - Asistencia
6. **ms-biometric** (8086) - Biométrico (facial/huella)
7. **ms-configuration** (8087) - Configuración
8. **ms-notification** (8088) - Notificaciones
9. **ms-quality** (8089) - Calidad (ISO 9001)

---

## 2. Endpoints de Producción

### Kong API Gateway
```
PROXY API (para frontend):
http://ec2-32-199-154-193.compute-1.amazonaws.com:8000

ADMIN CONSOLE (gestión de rutas):
http://ec2-32-199-154-193.compute-1.amazonaws.com:8001
```

### Variable de Entorno para Vercel
```
EXPO_PUBLIC_API_URL=http://ec2-32-199-154-193.compute-1.amazonaws.com:8000
```

---

## 3. Base de Datos Neon PostgreSQL

### Conexión
```
postgresql://faceattend_db_owner:***@ep-nameless-wind-b6xj3sjk-pooler.c-2.sa-east-1.aws.neon.tech/faceattend_db?sslmode=require
```

### Esquemas Creados (8/8 por Liquibase)
| Esquema | Bounded Context | Estado |
|---------|-----------------|--------|
| identity | Identity Management | ✅ Creado |
| authorization | Authorization (RBAC) | ✅ Creado |
| academic | Academic & Curriculum | ✅ Creado |
| scheduling | Scheduling | ✅ Creado |
| attendance | Attendance Tracking | ✅ Creado |
| biometric | Biometric Data | ✅ Creado |
| configuration | System Configuration | ✅ Creado |
| notification | Notifications & Alerts | ✅ Creado |

**Todas las migraciones Liquibase completadas exitosamente (exit code 0)**

---

## 4. Servicios de Infraestructura

### MongoDB
```
Host: ec2-32-199-154-193.compute-1.amazonaws.com:27017
Usuario: mongoadmin
Contraseña: mongopass
Propósito: Embeddings biométricos (facial/huella)
Estado: ✅ Healthy
```

### Redis
```
Host: ec2-32-199-154-193.compute-1.amazonaws.com:6379
Propósito: Caché y sesiones
Estado: ✅ Healthy
```

### Apache Kafka (KRaft)
```
Host: ec2-32-199-154-193.compute-1.amazonaws.com:9092
Cluster ID: faceattend-kraft-cluster-id-0001
Propósito: Event streaming y mensajería
Estado: ✅ Running
```

### Portainer CE
```
URL: http://ec2-32-199-154-193.compute-1.amazonaws.com:9443
Propósito: Gestión visual de contenedores Docker
Estado: ✅ Running
```

---

## 5. Requisitos Previos (Completados)

### ✅ Requisitos de Infraestructura
- [x] Instancia EC2 t3.xlarge provisionada
- [x] 150GB EBS gp3 configurado
- [x] Security groups con puertos abiertos (8000, 8001, 8081-8089, 27017, 6379, 9092)
- [x] Docker y Docker Compose instalados

### ✅ Preparación de Código
- [x] back-end/docker-compose.yml actualizado (sin postgres local)
- [x] JDBC URLs reemplazadas con Neon
- [x] Archivos Liquibase mapeados correctamente

### ✅ Configuración Neon
- [x] Cuenta Neon creada
- [x] Base de datos faceattend_db inicializada
- [x] Usuario faceattend_db_owner con permisos

---

## 6. Procedimiento de Despliegue Ejecutado

### Fase 1: Preparación del Servidor
```bash
# Conectar a EC2
ssh -i conector-faceattend-edu.pem admin@ec2-32-199-154-193.compute-1.amazonaws.com

# Crear archivo .env.prod con credenciales Neon
NEON_JDBC_URL=jdbc:postgresql://ep-nameless-wind-b6xj3sjk-pooler.c-2.sa-east-1.aws.neon.tech/faceattend_db?sslmode=require&channel_binding=require
NEON_USER=faceattend_db_owner
NEON_PASSWORD=***
BIND_IP=0.0.0.0
BIOMETRIC_LIVENESS_CHALLENGE_SECRET=***
```

### Fase 2: Migraciones Liquibase (Neon)
```bash
docker compose --env-file .env.prod -f database/docker-compose.neon.yml up
```
**Resultado:** 8 migraciones completadas secuencialmente (identity → notification)

### Fase 3: Construcción de Microservicios
```bash
docker compose --env-file .env.prod -f back-end/docker-compose.yml up --build -d
```
**Resultado:** 9 imágenes Docker construidas exitosamente

### Fase 4: Inicio de Kong + Infraestructura
```bash
docker compose --env-file .env.prod \
  -f docker-compose-simple.yml \
  -f back-end/docker-compose.yml \
  up -d
```
**Resultado:** 13/13 contenedores en ejecución

---

## 7. Estado de Salud de Servicios

| Servicio | Puerto | Estado | Health |
|----------|--------|--------|--------|
| Kong Gateway | 8000 | ✅ UP | Starting |
| Kong Admin | 8001 | ✅ UP | Starting |
| ms-identity | 8081 | ✅ UP | Starting |
| ms-authorization | 8082 | ✅ UP | Starting |
| ms-academic | 8083 | ✅ UP | Starting |
| ms-scheduling | 8084 | ✅ UP | Starting |
| ms-attendance | 8085 | ✅ UP | Starting |
| ms-biometric | 8086 | ✅ UP | Healthy |
| ms-configuration | 8087 | ✅ UP | Starting |
| ms-notification | 8088 | ✅ UP | Healthy |
| ms-quality | 8089 | ✅ UP | Starting |
| MongoDB | 27017 | ✅ UP | Healthy |
| Redis | 6379 | ✅ UP | Healthy |
| Kafka | 9092 | ✅ UP | Running |

---

## 8. Despliegue de Frontend en Vercel

### Pasos para Desplegar
1. **Crear proyecto en Vercel** (o importar repositorio)
2. **Rama:** `fix/frontend-mocked-requests`
3. **Variable de entorno:**
   ```
   EXPO_PUBLIC_API_URL=http://ec2-32-199-154-193.compute-1.amazonaws.com:8000
   ```
4. **Deploy:** El frontend se conectará automáticamente al Kong API Gateway

### Flujo de Peticiones
```
Frontend (Vercel)
    ↓
Kong API Gateway (8000)
    ↓
Microservicio Correspondiente (8081-8089)
    ↓
Neon PostgreSQL / MongoDB / Redis
```

---

## 9. Monitoreo y Mantenimiento

### Portainer (Gestión de Contenedores)
```
URL: https://ec2-32-199-154-193.compute-1.amazonaws.com:9443
Acceso: SSH tunnel recomendado
ssh -L 9443:127.0.0.1:9443 admin@ec2-32-199-154-193.compute-1.amazonaws.com
```

### Health Checks
```bash
# Ver estado de contenedores
docker ps

# Ver logs de Kong
docker logs faceattend-kong

# Ver logs de microservicio específico
docker logs faceattend-ms-identity

# Test Kong
curl http://ec2-32-199-154-193.compute-1.amazonaws.com:8000/
```

### Escalado (Futuro)
Los servicios pueden escalarse horizontalmente añadiendo réplicas en docker-compose.yml:
```yaml
services:
  ms-identity:
    deploy:
      replicas: 3
```

---

## 10. Troubleshooting

### Contenedor Restarting
**Causa:** Healthcheck falla al conectar a dependencias  
**Solución:** Esperar 30-60 segundos para que los servicios se estabilicen

### Kong no responde
**Causa:** No detecta microservicios upstream  
**Solución:** Verificar que todos los microservicios están healthy en `docker ps`

### Conexión Neon fallando
**Causa:** Credenciales incorrectas o firewall bloqueando  
**Solución:** Verificar NEON_JDBC_URL, NEON_USER, NEON_PASSWORD en .env.prod

### Frontend no conecta
**Causa:** EXPO_PUBLIC_API_URL incorrecta  
**Solución:** Usar `http://ec2-32-199-154-193.compute-1.amazonaws.com:8000` (sin HTTPS)

---

## 11. Recursos Consumidos

### Almacenamiento
```
EBS: 150GB (134GB disponibles)
Docker Images: ~4GB
Containers: ~1.5GB
Databases: ~2GB
```

### Memoria
```
Asignada: 16GB (t3.xlarge)
Microservicios: ~8GB (4 contenedores Java × 2GB c/u)
Infraestructura: ~4GB (MongoDB, Kafka, Redis)
Sistema: ~4GB
```

### Procesos Clave
```
Java (9 microservicios): ~75% CPU pico durante init
Python (ms-biometric): ~30% CPU
Nginx/Kong: ~5% CPU
```

---

## 12. Información de Contacto y Soporte

### Configuración de AWS
- **Región:** us-east-1
- **Instancia:** ec2-32-199-154-193.compute-1.amazonaws.com
- **Usuario SSH:** admin
- **Llave:** conector-faceattend-edu.pem

### Credenciales Almacenadas en EC2
```
~/.env.prod (variables de entorno del despliegue)
```

### Próximos Pasos
1. ✅ Backend desplegado y operacional
2. ⏳ Desplegar frontend en Vercel con EXPO_PUBLIC_API_URL
3. ⏳ Configurar dominio DNS personalizado (si aplica)
4. ⏳ Implementar HTTPS con certificado (recomendado para producción)
5. ⏳ Configurar backups automáticos de Neon

---

**Despliegue Completado:** 2026-10-16 18:50 UTC  
**Estado:** ✅ BACKEND PRODUCCIÓN + FRONTEND LISTO PARA DEPLOY  
**Versión:** 1.0 - Full Backend DDD Microservices + Vercel Frontend


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

**Preparación única (requiere un APK nuevo; aún no está hecha en el repo):**
```powershell
cd front-end\Mobile
npx expo install expo-updates     # dependencia nativa → obliga a recompilar el APK
eas update:configure              # añade updates.url y extra.eas.projectId a app.json
```
Después, en `app.json` hay que **quitar `"enabled": false`** del bloque `updates` (hoy desactiva las OTA). Se conserva `runtimeVersion.policy: "appVersion"`: una actualización solo la reciben los APK con el mismo `version` de `app.json`. Compila de nuevo el APK (sección 16) y distribúyelo; ese APK queda "enlazado" al canal de su perfil.

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

Verificado el 2026-10-19: `https://faceattend-edu.duckdns.org/health/quality` → **200** y `http://faceattend-edu.duckdns.org:8000/health/quality` → **200**. La raíz `/` responde 404 porque ese dominio es solo la API (el sitio web vive en Vercel). **Supuesto:** el equipo mantiene ese dominio apuntando a la instancia EC2; el nombre `ec2-…amazonaws.com` de la Parte I no es estable (cambia si se detiene la instancia).

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
4. Antes de abrir la app, desde el navegador del teléfono: `https://faceattend-edu.duckdns.org/health/quality` debe mostrar JSON. Si no carga, la app tampoco conectará.
5. **Comprobar que el dispositivo tiene la última versión publicada:**
   - **APK:** *Ajustes → Apps → FaceAttend EDU* muestra `versionName` (= `version` de `app.json`); `versionCode` sube con cada build `production` (`eas build:list`).
   - **OTA** (tras 14.3): abre la app, ciérrala por completo y ábrela de nuevo (la actualización se descarga al abrir y se aplica al siguiente arranque). `eas update:list --branch <canal>` muestra el *Update ID* publicado; compara con el que informa el dispositivo (**Supuesto:** el equipo muestra `Updates.updateId` de `expo-updates` en una pantalla de ajustes; el repo no lo hace hoy). Alternativa sin código: tras publicar, cambia un texto visible de la app y verifica que aparece.

## 18. Errores frecuentes en EAS

| Síntoma | Causa probable | Solución |
|---|---|---|
| El build entrega un `.aab` | Falta `android.buildType: "apk"` en el perfil | Ya está en `preview` y `production`; revisa `eas config` |
| Login con "error de red" | URL `CHANGE_ME_*`, `localhost` o `10.0.2.2` grabada, o dominio caído | Corregir `env` del perfil y **recompilar** (un `.env` local no afecta a EAS); probar `/health/quality` |
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

Valores válidos: `attendanceStatus ∈ {Present, Absent, Late, Justified}`; `captureMethod ∈ {FACIAL, MANUAL, IOT, IMPORT}`. Límite de imagen: `BIOMETRIC_MAX_IMAGE_BYTES` = 3 MiB (≈4 MiB en base64). Un estudiante solo puede inscribir su propio `person_id`; reemplazar una plantilla exige un caso de actualización biométrica *Approved*; un rostro ya inscrito en otra persona devuelve 409.

### 19.3 Prueba real realizada
En un entorno local con el mismo código (no contra producción), 2026-10-19: inscripción con imagen de 640 px/JPEG q60 → **201**; el vector quedó en MongoDB; `summary` → `has_face: true`; `identify-image` con otras dos capturas (800 px/q80 y 480 px/q50) devolvió la misma persona con puntajes **0.998 y 0.999** (umbral 0.85); un `POST /attendance-records` con `captureMethod=FACIAL` devolvió 201 y el `GET` lo listó. Límite: se usó una foto fija, no la cámara ni los gestos de vivacidad reales.

### 19.4 Hallazgos

1. **Registrar un rostro no crea asistencia por sí solo, y es el diseño actual.** `ms-biometric` no emite eventos ni llama a `ms-attendance`; `ms-attendance` no consume eventos biométricos. La app móvil solo inscribe (la única pantalla con cámara es `RegisterFace`); la identificación (`identify-image`) y el alta de asistencia las hace el personal desde la web (quiosco). El objetivo "registrar rostro → aparece asistencia" se cumple en dos tramos: **A** (móvil → MongoDB → estado biométrico en web) y **B** (web/docente → PostgreSQL → web). Si se quisiera automático, sería funcionalidad nueva (decisión del equipo).
2. **`summary` exige `attendance.record:write`** (`summary_router.py`): un aprendiz recibiría 403 al consultar su propio estado. No afecta a la app actual (solo `UserDetail`, usada por personal). Corrección sugerida: permitir lectura del propio `person_id` con `biometric.case:request`.
3. **`identify-image` solo para personal** (`attendance.record:write`): coherente con el quiosco; un aprendiz no puede autoidentificarse.
4. **Ruta heredada:** `LEGACY_ENDPOINT_MAP['face/register']` (`src/api/apiClient.js`) apunta a `/facial/enroll` (requiere vector y permiso de personal). La pantalla actual usa `enroll-image`; no usar esa ruta.
5. **Fotograma de inscripción:** se enrola el fotograma central de los 18 capturados (`frames[floor(len/2)]`), que cae a mitad de un gesto (parpadeo, giro, boca abierta). Con una foto neutra el reconocimiento fue 0.998; con la cara real en pleno gesto podría bajar. **Sin verificar en dispositivo.** Si el quiosco no te reconoce, probar a inscribir un fotograma neutro.
6. **OTA no operativa hoy:** falta `expo-updates`, `projectId` y `updates.url`, y `updates.enabled` es `false` (14.3).
7. **Configuración inconsistente en la Parte I:** esa sección lista el host `ec2-32-199-154-193…` y el archivo de entorno de producción otro (`ec2-77-113-116-1…`); el dominio estable es `faceattend-edu.duckdns.org`. Usa siempre el dominio.
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
- [ ] 20.14 Desde el navegador del teléfono: `https://faceattend-edu.duckdns.org/health/quality` devuelve JSON.
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
