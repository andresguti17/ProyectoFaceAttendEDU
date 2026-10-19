# Configuración de GitHub para los despliegues

Repositorio: `andresguti17/ProyectoFaceAttendEDU`. Workflows en `.github/workflows/`:

| Workflow | Qué hace | Disparo |
|---|---|---|
| `ci.yml` | Tests de todos los servicios y web/mobile | push y PR a `main`, y `workflow_call` |
| `deploy-database.yml` | Migraciones Liquibase contra Neon | `workflow_call`, manual |
| `deploy-backend.yml` | SSH a EC2 → `docker compose up --build` + health check | `workflow_call`, manual |
| `deploy-frontend.yml` | Build y deploy a Vercel | `workflow_call`, manual, push a la rama de prueba |
| `deploy-production.yml` | Orquesta: CI → Neon → EC2 → Vercel | push a `main`, manual con `target` |

## 1. Environment `production`

Crear en GitHub → Settings → Environments → `production`:

- **Required reviewers**: tu usuario (aprobación manual antes de tocar Neon, EC2 o Vercel).
- **Deployment branches**: solo `main`.

Equivalente con gh CLI (requiere permisos de admin en el repo):

```bash
gh api -X PUT repos/andresguti17/ProyectoFaceAttendEDU/environments/production
```

## 2. Secrets y variables

Los secrets van al environment `production` (no a nivel de repo) para que solo jobs aprobados los lean.

### Neon (migraciones)

| Nombre | Tipo | Valor |
|---|---|---|
| `NEON_JDBC_URL` | secret | `jdbc:postgresql://<host>/faceattend_db?sslmode=require&channel_binding=require` |
| `NEON_USER` | secret | usuario de Neon (`faceattend_db_owner`) |
| `NEON_PASSWORD` | secret | contraseña de Neon **rotada** (ver §4) |

### EC2 (backend)

| Nombre | Tipo | Valor |
|---|---|---|
| `EC2_HOST` | variable | DNS público de la instancia (ver `DESPLIEGUE.md`, confirmar) |
| `EC2_USER` | variable | usuario SSH del host (`admin` según `DESPLIEGUE.md`, confirmar) |
| `EC2_DEPLOY_DIR` | variable | ruta absoluta del clon del repo en el host, p. ej. `/home/admin/FaceAttendEDU` |
| `EC2_SSH_KEY` | secret | **clave privada nueva, dedicada a CI** (no la `.pem` personal) |
| `EC2_KNOWN_HOSTS` | secret | salida de `ssh-keyscan -t ed25519 <EC2_HOST>` (verificar la huella antes) |
| `ENV_PROD_FILE` | secret (opcional) | contenido completo de `.env.prod`. Si no se define, se usa el que ya existe en el host |

Preparación en el host (una vez):

```bash
# Clave dedicada a CI: se genera en tu máquina, la pública va al host
ssh-keygen -t ed25519 -f faceattend-ci -C "github-actions-deploy" -N ""
# Añadir faceattend-ci.pub a ~/.ssh/authorized_keys del usuario EC2_USER

# Huella del host para EC2_KNOWN_HOSTS (compara la huella con la de la consola de AWS)
ssh-keyscan -t ed25519 <EC2_HOST>
```

El directorio `EC2_DEPLOY_DIR` debe ser un clon de este repo con `origin` accesible desde el host
(si el repo es privado, configurar un deploy key de solo lectura en el host).

### Vercel (frontend)

| Nombre | Tipo | Valor |
|---|---|---|
| `VERCEL_TOKEN` | secret | token creado en Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | secret | `team_2JCO0Yx1M33zt4GzqEH7tJHl` |
| `VERCEL_PROJECT_ID` | secret | `prj_M7w8tE9MQnciAmdrZyvyAOst5T2N` |

`EXPO_PUBLIC_API_URL` se define en Vercel (Settings → Environment Variables), apuntando al Kong de EC2.

## 3. Cargar los valores con gh CLI

Ejecuta cada comando tú, en tu terminal. Pegará el valor de forma interactiva y no queda en el historial:

```bash
gh secret set NEON_JDBC_URL --env production --repo andresguti17/ProyectoFaceAttendEDU
gh secret set NEON_USER --env production --repo andresguti17/ProyectoFaceAttendEDU
gh secret set NEON_PASSWORD --env production --repo andresguti17/ProyectoFaceAttendEDU
gh secret set EC2_SSH_KEY --env production --repo andresguti17/ProyectoFaceAttendEDU < faceattend-ci
gh secret set EC2_KNOWN_HOSTS --env production --repo andresguti17/ProyectoFaceAttendEDU
gh secret set ENV_PROD_FILE --env production --repo andresguti17/ProyectoFaceAttendEDU < .env.prod
gh secret set VERCEL_TOKEN --env production --repo andresguti17/ProyectoFaceAttendEDU
gh secret set VERCEL_ORG_ID --env production --repo andresguti17/ProyectoFaceAttendEDU
gh secret set VERCEL_PROJECT_ID --env production --repo andresguti17/ProyectoFaceAttendEDU

gh variable set EC2_HOST --env production --repo andresguti17/ProyectoFaceAttendEDU --body "<EC2_HOST>"
gh variable set EC2_USER --env production --repo andresguti17/ProyectoFaceAttendEDU --body "admin"
gh variable set EC2_DEPLOY_DIR --env production --repo andresguti17/ProyectoFaceAttendEDU --body "<ruta>"
```

Nota: `gh secret set --env` requiere que el environment `production` ya exista (§1).

## 4. Antes de activar nada: credenciales expuestas

`DESPLIEGUE.md` tiene en texto plano la contraseña de MongoDB, la URL/usuario de Neon y referencias a la
clave `.pem`. Ese archivo está versionado en git. Antes del primer despliegue automatizado:

1. Rotar la contraseña de Neon (Neon → Roles → reset password) y actualizar `NEON_PASSWORD` y `ENV_PROD_FILE`.
2. Rotar la contraseña de MongoDB en el host y en `.env.prod`.
3. Quitar las credenciales de `DESPLIEGUE.md` (sustituir por "ver GitHub Secrets").
4. Revisar en el Security Group que 27017, 6379 y 9092 no estén abiertos a internet.

## 5. Primera ejecución (orden recomendado)

1. Manual: **Actions → Deploy database (Neon) → Run workflow**. Es idempotente; aprobar en el environment.
2. Manual: **Actions → Deploy backend (EC2) → Run workflow**. Revisar el log del health check.
3. Manual: **Actions → Deploy frontend (Vercel) → Run workflow** con `environment: preview` para validar.
4. Cuando todo lo anterior sea verde: **Deploy production** con `target: all` o un push a `main`.

## 6. Rollback

- Backend: volver a ejecutar `deploy-backend.yml` manualmente desde el SHA anterior (el workflow usa el SHA de la
  ejecución: lanzarlo desde el ref de ese commit), o en el host `git checkout <sha>` y `docker compose ... up -d --build`.
- Frontend: en Vercel, promover un deployment anterior (Deployments → ⋯ → Promote to Production).
- Base de datos: **no hay rollback automático**. Liquibase solo avanza; cualquier reversa es un changeset nuevo.
