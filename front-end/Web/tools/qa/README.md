# tools/qa — revisión automatizada

Dos capas que acompañan a `docs/revision/` (ver `00-PROTOCOLO.md` §9):

| Archivo | Qué hace |
|---|---|
| `run.mjs` | Comando único: preflight, reconstrucción opcional del front, L1, L2 y `RESUMEN.md` |
| `api-matrix.mjs` | **L1**: casos negativos de API por rol (permisos, aislamiento entre sedes, validaciones) |
| `ui-smoke.mjs` | **L2**: inicia sesión por el formulario y abre cada ruta de cada rol |
| `lib.mjs` | Cliente HTTP, login, `SELECT` de solo lectura, informes |

## Requisitos
- Stack levantado (`docker ps` con los contenedores `healthy`) y el front en `http://localhost:8090`.
- Chrome o Edge instalado (`playwright-core` no descarga navegadores).
- `docs/revision/.cuentas.local` con `usuario=contraseña` para `admin.faceattend`, `fermin`, `admin.ict`, `maria.sanchez`, `est.ict` (el archivo no se versiona).

## Uso
```bash
npm run qa                              # todo
npm run qa:rebuild                      # reconstruye el front antes
npm run qa:api                          # solo L1
npm run qa:ui -- --roles=EST --mobile   # solo L2, un rol, con pasada de 375 px
```
Variables: `QA_WEB_URL`, `QA_API_URL`, `QA_ACCOUNTS_FILE`, `QA_DB_CONTAINER`.

## Seguridad de los datos
- La base **solo se consulta con `SELECT`** (`lib.sql` rechaza cualquier otra sentencia).
- Las escrituras de prueba pasan por la API y llevan `QA` en su nombre; al terminar se **desactivan** (borrado lógico).
- Si una acción prohibida llegara a ejecutarse (un bug real), el script la **revierte** y la reporta como FAIL.
- Kong limita a 300 peticiones/min: ante un `429` el cliente espera y reintenta.

## Resultados
`docs/revision/resultados/` (ignorado por git): `RESUMEN.md`, `L1-api.md/.json`, `L2-ui.md/.json` y capturas en `ui/` de las rutas que no dieron PASS.
