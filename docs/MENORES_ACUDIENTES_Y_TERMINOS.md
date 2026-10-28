# Menores de edad, acudientes y términos y condiciones

Cómo el aplicativo (web y móvil) trata el registro, la aceptación de términos y la
verificación facial según la edad. Marco: Ley 1581 de 2012 art. 7 y Decreto 1377 de 2013
(compilado en el Decreto 1074 de 2015), sentencia C-748 de 2011.

## 1. Flujo por tipo de usuario

### Adulto (aprendiz, estudiante, instructor, administrador)

1. Ingresa (web o móvil). Si no ha firmado los términos vigentes, ve la pantalla de términos
   (`TermsGate` en la web, `TerminosModal` con botón de firma en el móvil).
2. Firma. Se guarda **una fila** en `identity.terms_acceptance` (versión, fecha, tipo `ADULT`,
   `accepted_by = SELF`, canal `self`, sede).
3. No se vuelve a pedir, salvo que cambie `faceattend.terms.version` (todos firman de nuevo).
4. Nadie puede aceptar por un adulto: un administrador recibe `403`.

### Menor de edad (aprendiz o estudiante)

El menor **no puede completar su registro desde el aplicativo**.

| Paso | Quién | Dónde | Resultado |
|---|---|---|---|
| 1 | Administrador de la sede | Detalle del aprendiz → «Completar registro» | Registra y vincula al acudiente (`POST /persons/{id}/guardian`) |
| 2 | Acudiente, **presente en la sede**, con el administrador | Mismo modal | El administrador registra la aceptación de los términos (`POST /persons/{id}/terms`) y la autorización de datos a nombre del menor |
| 3 | Administrador | «Continuar al registro facial» | Captura los parámetros faciales del aprendiz con el flujo biométrico existente |

Mientras falte el paso 1 o el 2 el menor ve una pantalla de bloqueo con el paso pendiente
(`MinorBlockedGate` en la web, `MinorBlockedModal` en el móvil). No puede usar funciones que
exigen términos ni la verificación facial. La biometría sigue siendo facultativa: el acudiente
decide si autoriza los datos biométricos del menor.

Casos que cubren las pruebas:

| Caso | `status` | Pantalla |
|---|---|---|
| Adulto, primer ingreso | `TERMS_PENDING` | Firmar términos |
| Menor sin acudiente | `GUARDIAN_PENDING` | Bloqueo, paso «acudiente» |
| Menor con acudiente y términos pendientes | `TERMS_PENDING` | Bloqueo, paso «términos» |
| Menor con acudiente y términos aceptados | `ENABLED` | Entra |

## 2. Cambios en el modelo de datos

Migración `database/01-ms-identity-db/01-ddl/03-tables/014-create-guardian-and-terms-acceptance-tables.yaml`
(changeSets `id-016` e `id-017`). Hay que aplicarla **antes** de levantar identity
(`ddl-auto: validate`).

**`identity.guardian`**: un acudiente activo por menor (índice único parcial
`WHERE deleted_at IS NULL`). Nombre, número de documento, correo y teléfono se guardan cifrados
(AES-256-GCM, `enc:v1:`). Tipos de documento permitidos: CC, CE, PP. Se exige correo o teléfono.
Cambiar el documento reemplaza al acudiente (la fila anterior queda con `deleted_at`).
Auditoría: `created_by`, `updated_by`, `deleted_by`, `school_id`.

**`identity.terms_acceptance`**: una fila por aceptación. `terms_version`, `user_type`
(`ADULT`/`MINOR`), `accepted_by` (`SELF`/`GUARDIAN`), `guardian_id`, `channel`
(`self`/`assisted`), `recorded_by` (quién la registró), `school_id`, `accepted_at`. La vigente es
la más reciente. Si el menor cambia de acudiente, la aceptación del anterior deja de valer.

**`biometric_match_logs`** (MongoDB, TTL 90 días): nuevo campo `actor_user_id`, el usuario que
hizo la llamada. Todo enrolamiento facial o de huella deja una entrada `ENROLL`. Para un menor
es el administrador que lo enroló con el acudiente presente.

## 3. Endpoints

Todos pasan por Kong (`/api/v1/persons` ya enruta a identity).

| Método y ruta | Quién | Notas |
|---|---|---|
| `GET /api/v1/persons/{id}/terms` | Cualquier rol en su alcance | Estado: `minor`, `guardianRegistered`, `termsUpToDate`, `status`, `pendingStep`, `enabled` |
| `POST /api/v1/persons/{id}/terms` | Adulto: él mismo. Menor: administrador | Body `{termsVersion}`. Solo la versión vigente. `403` si un menor se firma a sí mismo o alguien firma por un adulto. `400` si el menor no tiene acudiente |
| `GET/POST/PUT /api/v1/persons/{minorId}/guardian` | Solo administradores (`identity.person:write`) | `POST` `409` si ya hay uno; `PUT` `404` si no hay; `400` si la persona es adulta |
| biometric `POST /facial/enroll`, `/enroll-image`, `/fingerprint/*`, WebSocket | — | Ahora exigen `enabled = true` en identity: `403 PERSON_NOT_ENABLED` con el paso pendiente. Un menor no enrola su propio rostro: `403 MINOR_ENROLLMENT_BY_ADMIN_ONLY` |

Configuración nueva:

- `faceattend.terms.version` (identity, por defecto `2026-10`; variable de entorno `FACEATTEND_TERMS_VERSION`).
  Debe coincidir con `TERMS_VERSION` de `front-end/Web/src/core/config/terms.js` y de
  `front-end/Mobile/src/services/termsService.js`.
- `BIOMETRIC_ENABLEMENT_CHECK_ENABLED` (biometric, por defecto `true`).

Los permisos no cambian: se reutiliza `identity.person:write` (Super Administrador y
Administrador) para el acudiente; los términos usan `identity.person:read`, y el caso de uso
decide quién puede firmar.

## 4. Seguridad y trazabilidad

- Datos de menores y acudientes: acceso solo para el administrador de la sede (el filtro de
  alcance de identity acota las personas por sede; el acudiente exige además `identity.person:write`).
- Cifrado en reposo del acudiente y de las plantillas biométricas; TLS en tránsito.
- Quién, cuándo y en qué sede: `terms_acceptance.recorded_by/accepted_at/school_id`,
  `guardian.created_by/updated_by/school_id` y `biometric_match_logs.actor_user_id`.
- La sede se resuelve en academic con la sesión de quien llama. Si academic no responde la fila
  se guarda con `school_id` vacío y se registra una advertencia.
- Errores: validación del acudiente en cliente y servidor; los errores de red del flujo de firma
  se muestran sin dejar entrar; si identity no responde al ingresar el cliente no bloquea, pero
  el servidor biométrico falla cerrado (`503`).

## 5. Supuestos

1. Es menor quien tiene fecha de nacimiento < 18 años; **sin fecha de nacimiento, un documento TI
   cuenta como menor** (lado seguro). Sin fecha y con CC/CE/PP es adulto.
2. Un acudiente activo por menor. Un mismo acudiente con varios menores se registra una vez por menor.
3. Los términos son uno solo para web y móvil; el móvil no incluye registro de usuarios.
4. La política de privacidad existe solo en la web (`/privacy`, aviso al ingresar y en el alta de
   sede). El móvil no la muestra.
5. La autorización de datos del menor la registra el administrador en el mismo acto (canal
   `assisted`); el menor no acepta el aviso por sí mismo.
6. Los términos y la verificación facial son obligatorios para usar el aplicativo, pero la
   biometría sigue siendo facultativa (la asistencia se registra por otros medios).

## 6. Pendientes y riesgos

- Asistencia y justificaciones **no validan en el servidor** que el menor esté habilitado; hoy lo
  impiden las pantallas de bloqueo y que no tenga plantillas biométricas. Si se necesita defensa en
  profundidad, añadir la comprobación en los casos de uso de `05-ms-attendance`.
- Los aprendices menores ya existentes quedan bloqueados hasta que un administrador complete su
  registro: conviene avisarlo antes del despliegue.
- Si cambia la edad mínima prevista por el titular del proyecto o la lista de países para
  transferencias, ajustar los textos en `terms.js` / `privacy.js` y subir las versiones a la vez
  en web, móvil y servidor.
- Los textos son un borrador preparado con apoyo de IA; debe revisarlos un abogado habilitado en
  Colombia antes de publicar.
