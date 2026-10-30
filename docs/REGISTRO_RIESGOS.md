# Registro de riesgos técnicos y de operación

> **Borrador técnico.** Probabilidad e impacto son una propuesta del equipo técnico (escala bajo, medio, alto)
> y deben validarse con la institución. Los responsables están en `TODO`: no se asignan personas sin que el
> equipo lo decida.
>
> Fuentes: [EVALUACION_IMPACTO_BIOMETRIA.md](EVALUACION_IMPACTO_BIOMETRIA.md) §4 (riesgos del tratamiento
> biométrico), [DISENO_S10_SESION_HTTPONLY.md](DISENO_S10_SESION_HTTPONLY.md) (sesión web en cookie),
> [DESPLIEGUE.md](../DESPLIEGUE.md), [COMPOSE.md](../COMPOSE.md) y los scripts de `database/scripts/` y
> `tools/monitor/`. Los procedimientos de respuesta están en [RUNBOOK_OPERACION.md](RUNBOOK_OPERACION.md) e
> [INCIDENTES.md](INCIDENTES.md).

Revisar este registro en cada entrega que cambie infraestructura, sesión o biometría, y al menos una vez por
trimestre. `TODO`: responsable de mantenerlo y fecha de la próxima revisión.

## 1. Riesgos del tratamiento biométrico

Están descritos, con sus controles, en la evaluación de impacto; aquí solo se listan para tener un único
tablero. Ver el detalle allí antes de cambiar su estado.

| # | Riesgo | Prob. | Impacto | Control existente (resumen) | Pendiente | Responsable |
|---|---|---|---|---|---|---|
| B-01 | Filtración de plantillas o muestras de huella (EIB R1) | Media | Alto | AES-256-GCM con clave fuera de la base; respaldo con cifrado opcional | Clave única sin rotación; cifrado de respaldos obligatorio | `TODO` |
| B-02 | Acceso de personal de otra sede (EIB R2) | Media | Alto | Alcance por sede en el servicio biométrico | `/identify-image`, `/identify-sample` y WebSocket verificados solo con tests | `TODO` |
| B-03 | Suplantación con foto, video o muestra ajena (EIB R3) | Media | Medio | Prueba de vida por gestos con reto firmado de 120 s | Pruebas de ataque de presentación | `TODO` |
| B-04 | Falso rechazo / falsa aceptación (EIB R4, R5) | Media / Baja | Medio | Umbral 0,5; alternativa manual | FAR y FRR sin medir (EIB §6) | `TODO` |
| B-05 | Sesgo del modelo por grupo (EIB R6) | Media | Alto | Ninguno específico | Medición por grupos antes del piloto | `TODO` |
| B-06 | Tratamiento sin autorización válida (EIB R7) | Media | Alto | Verificación de autorización y acudiente, falla cerrado | Revisar menores enrolados antes de #309 | `TODO` |
| B-07 | Conservación excesiva (EIB R8) | Media | Medio | TTL de 90 días en registros de verificación | Plazo de plantillas y asistencia | `TODO` |
| B-08 | Uso con otra finalidad y transferencia internacional (EIB R10, R11) | Baja | Alto | Consulta solo desde el kiosco | Política escrita; contratos de transmisión | `TODO` |

## 2. Riesgos de la sesión web (S-10)

| # | Riesgo | Prob. | Impacto | Control existente | Pendiente | Responsable |
|---|---|---|---|---|---|---|
| S-01 | Un XSS usa la sesión desde la propia página | Baja | Alto | CSP `script-src 'self'` en `vercel.json`; la cookie HttpOnly impide leer y exfiltrar el token | Ninguna defensa adicional prevista (fuera de alcance del S-10, §8 del diseño) | `TODO` |
| S-02 | CSRF contra la cookie de sesión | Baja | Alto | `SameSite=Lax`; Kong exige `X-Requested-With: FaceAttend` y `Origin` permitido en métodos no seguros; probado con `back-end/99-api-gateway/tests/cookie-session.sh` | Mantener `KONG_CORS_ORIGINS` explícito (nunca `*`) | `TODO` |
| S-03 | Un proxy o CDN elimina la cabecera `Cookie` y los usuarios pierden la sesión | Baja | Medio | Salida al modo bearer sin tocar el backend (RUNBOOK §6) | Prueba de punta a punta en el entorno real | `TODO` |
| S-04 | Detrás del proxy de Vercel, los límites por IP de Kong e identity ven la IP de Vercel y no la del cliente | Media | Medio | Ninguno verificado | Comprobar en producción qué IP llega y, si es la de Vercel, confiar en `X-Forwarded-For` solo desde Vercel | `TODO` |
| S-05 | Tickets del WebSocket en un diccionario local de Kong: con más de un gateway un ticket emitido en un nodo no se canjea en otro | Baja (hoy hay un solo nodo) | Medio | Un único Kong | Almacén compartido si se escala Kong | `TODO` |
| S-06 | Mezcla de modos cookie y bearer en un navegador | Baja | Bajo | Kong da prioridad a `Authorization` | Ninguno | `TODO` |
| S-07 | Quedarse en modo bearer tras usarlo como salida temporal | Media | Medio | El modo cookie es el predeterminado | Registrar cada cambio de modo y su vuelta (RUNBOOK §6) | `TODO` |

## 3. Riesgos de operación

| # | Riesgo | Prob. | Impacto | Control existente | Pendiente | Responsable |
|---|---|---|---|---|---|---|
| O-01 | Pérdida de datos de PostgreSQL en producción sin respaldo propio | Baja | Alto | La base está en Neon (servicio gestionado) | `backup.sh` no cubre Neon: definir y probar respaldo y restauración (RUNBOOK §3.2) | `TODO` |
| O-02 | Respaldos manuales: no se hacen, o se guardan en el mismo servidor | Alta | Alto | `backup.sh`, `restore.sh` y `verify-restore.sh` probados en local | Programar con cron, retención y copia fuera del servidor | `TODO` |
| O-03 | Pérdida de las claves de cifrado (`PII_*`, `BIOMETRIC_ENCRYPTION_KEY`, `MINIO_KMS_SECRET_KEY`, `BACKUP_PASSPHRASE`): los datos quedan ilegibles | Baja | Alto | DESPLIEGUE §3 pide respaldarlas aparte | Confirmar dónde están guardadas y quién accede | `TODO` |
| O-04 | Despliegue defectuoso sin vuelta atrás rápida: las imágenes `faceattend/*:latest` se sobrescriben | Media | Medio | Volver a desplegar el commit anterior (reconstruye, minutos) | Etiqueta por commit (`FACEATTEND_IMAGE_TAG`) en el workflow (RUNBOOK §2.1) | `TODO` |
| O-05 | Migración de Neon incompatible con la versión anterior al volver atrás | Baja | Alto | Liquibase hacia adelante; CI antes de migrar | Procedimiento de reversión de migraciones | `TODO` |
| O-06 | Caída de la instancia sin aviso: el monitor corre en el mismo servidor | Media | Alto | `tools/monitor/check.sh` con aviso por webhook | Monitor externo sobre la URL pública | `TODO` |
| O-07 | Instancia única y sin entorno de pruebas: un fallo afecta a todos y los cambios se prueban en producción | Media | Alto | CI en cada PR; despliegue con espera de salud (600 s) | `TODO`: decidir si se crea staging | `TODO` |
| O-08 | Imágenes de terceros fijadas por digest sin parches de seguridad (Dependabot pausado) | Media | Medio | Digests fijados (un `pull` no cambia de versión sin aviso) | Revisión periódica de digests (`tools/digests/check.sh`, en otro PR) | `TODO` |
| O-09 | Rotación de la contraseña de Mongo aplicada solo en `.env.prod`: el siguiente despliegue la revierte y `ms-biometric` no conecta | Media | Medio | Procedimiento en DESPLIEGUE §6 y RUNBOOK §4 | Ninguno | `TODO` |
| O-10 | Falta la cuenta de servicio de notificaciones: nadie queda ausente al cerrar una clase y los reportes salen inflados | Baja | Medio | El servicio lo avisa en el log (`attendance alerts disabled`) | Incluir esa línea en lo que revisa el monitor | `TODO` |
| O-11 | Disco lleno por imágenes, respaldos o logs | Media | Medio | Alerta al 85 % en el monitor | Limpieza programada que conserve las etiquetas de vuelta atrás | `TODO` |
| O-12 | El dominio `duckdns.org` deja de apuntar a la instancia o el servicio gratuito falla | Baja | Alto | Dominio estable en vez del nombre `ec2-…` | `TODO`: decidir si se compra un dominio propio (opción B del S-10) | `TODO` |
| O-13 | App móvil con `usesCleartextTraffic: true` en producción | Baja | Medio | La URL de producción es HTTPS | Retirarlo en un APK nuevo (DESPLIEGUE §15) | `TODO` |
| O-14 | Responsables, canal y plazos de incidentes sin definir | Media | Alto | Procedimiento técnico en INCIDENTES.md | Completar los `TODO` de INCIDENTES.md con jurídica | `TODO` |

## 4. Cómo actualizar este registro

- Un riesgo se cierra solo con evidencia (PR, prueba o procedimiento probado) enlazada en la fila.
- Si cambian los riesgos biométricos, actualizar primero la evaluación de impacto y después la tabla del §1.
- Un riesgo nuevo entra con probabilidad, impacto, control existente (o "ninguno") y pendiente.
