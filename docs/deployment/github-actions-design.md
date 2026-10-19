# Diseño: despliegue con GitHub Actions

Estado: **workflows implementados** (ver `github-setup.md` para secretos, variables y orden de primera ejecución).
Pendiente: cargar secretos y variables en GitHub, rotar credenciales expuestas (§3.3) y validar con una ejecución manual.
Rama: `feature/github-actions-deploy` (desde `develop`).

## 1. Topología objetivo

| Componente | Destino | Cómo se despliega |
|---|---|---|
| Base de datos PostgreSQL 17 | **Neon** (`faceattend_db`, 8 schemas) | Migraciones Liquibase (`database/docker-compose.neon.yml`) ejecutadas desde Actions |
| Microservicios (9), Kong, MongoDB, Redis, Kafka, Portainer | **EC2** (`t3.xlarge`, us-east-1) | `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build` vía SSH |
| Frontend web (Expo web export) | **Vercel** (proyecto `faceattend-frontend`) | `vercel deploy --prod` con la CLI desde Actions |

Dependencias de orden: **Neon (migraciones) → EC2 (servicios) → Vercel (frontend)**,
porque el frontend apunta al Kong de EC2 y los servicios esperan el schema ya creado.

## 2. Workflows propuestos

Tres workflows separados, más uno reutilizable:

```
.github/workflows/
├── ci.yml                 (existente: tests, sin cambios)
├── deploy-database.yml    (nuevo) migraciones Liquibase contra Neon
├── deploy-backend.yml     (nuevo) despliegue a EC2 por SSH
├── deploy-frontend.yml    (nuevo) build + deploy a Vercel
└── deploy-production.yml  (nuevo, orquestador) llama a los tres en orden
```

### 2.1 Disparadores

- `push` a `main` → despliegue **producción** (`environment: production`, con revisión manual requerida).
- `workflow_dispatch` → despliegue manual, con input `target` (`database` | `backend` | `frontend` | `all`).
- `ci.yml` sigue corriendo en PR; el despliegue **solo** puede depender de `ci.yml` verde (vía `needs` o `workflow_run`).

Nota: `develop` no se despliega a producción. Si se quiere un entorno de staging, se
añade un `environment: staging` con sus propios secrets.

### 2.2 `deploy-database.yml` (Neon)

- Ejecuta el contenedor Liquibase de `database/docker-compose.neon.yml` con las credenciales
  de Neon como secrets.
- Usa `liquibase update` (idempotente). Nunca `drop` ni `rollback` automático.
- Antes de migrar: `liquibase status` para dejar constancia de qué changesets faltan.
- Permisos: el job solo corre en el environment `production` (aprobación manual).

Secrets: `NEON_JDBC_URL`, `NEON_USER`, `NEON_PASSWORD`.

### 2.3 `deploy-backend.yml` (EC2)

Pasos:
1. Checkout del commit a desplegar.
2. Conexión SSH al host (`appleboy/ssh-action` o equivalente, fijado a un SHA, no a una tag móvil).
3. En EC2: `git fetch && git checkout <sha>` en el directorio de despliegue.
4. Escribir `.env.prod` **desde secrets** (no versionado; el archivo ya existe en el host, así que
   el workflow solo lo regenera si el secret cambia).
5. `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`.
6. Health check: `curl` contra `http://<host>:8000/` y los `/health` de cada microservicio (8081–8089).
7. Si el health check falla → job rojo y, como mínimo, notificación. Rollback manual por ahora
   (`git checkout <sha_anterior>` + el mismo `up`); automatizarlo es una fase posterior.

Secrets: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` (clave privada dedicada a CI, no la personal),
`EC2_KNOWN_HOSTS` (para evitar TOFU), y las variables de `.env.prod` como secret único
`ENV_PROD_FILE` (contenido completo) o secrets individuales.

Restricciones conocidas:
- Portainer solo escucha en `127.0.0.1:9443` (túnel SSH). El workflow no lo toca.
- Los puertos de Mongo/Redis/Kafka están abiertos en el Security Group según `DESPLIEGUE.md`.
  Esto conviene cerrarlo (ver §4).

### 2.4 `deploy-frontend.yml` (Vercel)

- `npm ci` + `npx expo export --platform web` en `front-end/Web` (mismo comando que `ci.yml`).
- `vercel pull --environment=production` → `vercel build --prod` → `vercel deploy --prebuilt --prod`.
- Variable de build: `EXPO_PUBLIC_API_URL` (apunta al Kong de EC2). Se define en Vercel, no en el repo.

Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID` (`team_2JCO0Yx1M33zt4GzqEH7tJHl`),
`VERCEL_PROJECT_ID` (`prj_M7w8tE9MQnciAmdrZyvyAOst5T2N`). Los IDs no son secretos; el token sí.

### 2.5 `deploy-production.yml` (orquestador)

```yaml
jobs:
  database: { uses: ./.github/workflows/deploy-database.yml, secrets: inherit }
  backend:  { needs: database, uses: ./.github/workflows/deploy-backend.yml, secrets: inherit }
  frontend: { needs: backend,  uses: ./.github/workflows/deploy-frontend.yml, secrets: inherit }
```

Cada `uses:` debe declarar `on: workflow_call` en el reutilizable. Permisos mínimos: `contents: read`.

## 3. Seguridad

1. **Secrets solo en GitHub** (environment `production`), nunca en el repo.
2. **Revisión manual** en el environment `production` antes de cualquier job que toque Neon o EC2.
3. **Credenciales en texto plano en el repo**: `DESPLIEGUE.md` contiene la contraseña de
   MongoDB (`mongopass`), la URL de Neon con usuario, y menciona la clave `.pem`. Hay que:
   - sacar esos valores del documento (reemplazarlos por referencias a GitHub Secrets),
   - **rotar** la contraseña de Mongo y la de Neon, porque ya quedaron en git.
   Lo marco como acción prioritaria; no lo cambio sin tu confirmación.
4. Clave SSH dedicada a CI, con permisos solo sobre el directorio de despliegue.
5. `permissions:` explícito en cada workflow; `concurrency` por entorno para no desplegar dos veces a la vez.
6. Acciones de terceros fijadas a SHA cuando sea posible.

## 4. Pendientes de infraestructura (fuera del código)

- Dominio + HTTPS: hoy el frontend habla con `http://ec2-…:8000` (HTTP plano). El overlay
  `docker-compose.tls.yml` existe pero no está validado en producción. Un frontend en HTTPS (Vercel)
  no puede llamar a una API HTTP por el bloqueo de contenido mixto.
- Cerrar en el Security Group los puertos 27017, 6379 y 9092 a internet.
- Backups automáticos de Neon (pendiente según `DESPLIEGUE.md`).

## 5. Datos que necesito para implementar

Sin estos datos no puedo verificar conectividad ni configurar los workflows de punta a punta:

1. **EC2**: host (DNS público), usuario SSH, y **confirmación** de que la clave será una **nueva clave
   dedicada a CI** (la `conector-faceattend-edu.pem` personal no debería usarse en Actions).
   Ruta del directorio de despliegue en el host.
2. **Neon**: confirmar que la URL de conexión y el usuario se pueden guardar como secrets del repo.
   Yo no pruebo la conexión con credenciales que no me hayas dado en este chat.
3. **Vercel**: el `VERCEL_TOKEN` (lo creas tú en Vercel → Account Settings → Tokens y lo añades
   a GitHub Secrets). Confirmar si el proyecto `faceattend-frontend` ya tiene conectado el repo o si
   el deploy vía CLI es el camino.
4. **Entorno**: ¿quieres solo producción, o también staging en `develop`?
5. **Repositorio**: el `origin` es `andresguti17/ProyectoFaceAttendEDU`. Confirmar que los secrets
   se crean en ese repo.

## 6. Próximos pasos (orden)

1. Validar este diseño con el usuario.
2. Crear `deploy-database.yml` (el más sencillo; se puede probar con `workflow_dispatch`).
3. Crear `deploy-frontend.yml` y probar en un preview antes de prod.
4. Crear `deploy-backend.yml` con SSH y health checks.
5. Orquestador `deploy-production.yml`.
6. Rotar credenciales expuestas y limpiar `DESPLIEGUE.md`.
