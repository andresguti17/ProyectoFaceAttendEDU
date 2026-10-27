# Protección de datos personales — Ley 1581 de 2012

Qué hace FaceAttend EDU para cumplir la Ley 1581 de 2012 (Habeas Data) con los datos personales y biométricos, y por qué cada decisión técnica responde a un artículo concreto. No se agregan requisitos que la ley no pide; donde la ley fija el resultado pero no el medio, la elección técnica sale de las reglas del equipo (`fae-docs/00-governance/security-rules.md`).

## 1. Qué datos trata el sistema

| Dato | Dónde vive | Naturaleza (Ley 1581) |
|---|---|---|
| Nombre, apellido, tipo de documento | `identity.person` | Dato personal |
| Número de documento, correo, teléfono | `identity.person` (cifrado) | Dato personal |
| Grupo sanguíneo | `identity.person` (cifrado) | Dato sensible: salud (art. 5) |
| Plantilla facial (vector de 128 valores) | MongoDB `facial_embeddings` (cifrado) | Dato sensible: biométrico (art. 5) |
| Muestra de huella | MongoDB `fingerprint_embeddings` (cifrado) | Dato sensible: biométrico (art. 5) |
| Registros de asistencia y soportes de justificación | `attendance.*` y MinIO (cifrado SSE-S3) | Dato personal |

La foto del rostro no se guarda: se calcula la plantilla y se descarta la imagen.

## 2. Autorización previa, expresa e informada

| Requisito | Artículo | Implementación |
|---|---|---|
| Autorización previa, expresa e informada del titular | art. 9 | Tabla `identity.data_processing_consent`: una fila por aceptación con la versión del aviso, la fecha (`accepted_at`), el canal (`self` o `assisted`) y quién la registró. |
| Informar finalidad, carácter facultativo de los datos sensibles, derechos y responsable | art. 12 | Aviso de privacidad versionado (`PRIVACY_POLICY_VERSION`, web `core/config/privacy.js`; móvil `services/consentService.js`; servidor `faceattend.privacy.policy-version`). Solo se acepta la versión vigente. Si el texto cambia, se sube la versión y todos lo aceptan de nuevo al entrar. |
| Autorizar datos sensibles es facultativo y nadie puede ser obligado | art. 6-a | La autorización biométrica es una casilla aparte (`biometric_accepted`), nunca obligatoria. Sin ella la persona usa el sistema; su asistencia se registra por otros medios. |
| Conservar prueba de la autorización | art. 17-b | La fila de consentimiento queda en la base y no se borra al revocar; `GET /api/v1/persons/{id}/consent` la expone al titular y al administrador de su sede. |

Cuándo se pide:

- **Alta de cuentas** (`POST /api/v1/users/provision`): el servidor rechaza el alta sin `consent` con la versión vigente. El administrador confirma que el titular aceptó el aviso (canal `assisted`) y, aparte, si autorizó sus datos biométricos.
- **Alta pública de sede** (`POST /api/v1/onboarding/schools`): el administrador que se registra acepta el aviso (canal `self`).
- **Ingreso**: si falta la aceptación de la versión vigente, la web muestra el aviso y no deja continuar sin aceptarlo; el móvil la registra con la casilla de términos de la pantalla de ingreso.
- **Antes de capturar biometría**: web (registro facial y de huella) y móvil (registro facial) consultan la autorización y no abren la cámara ni el lector sin ella. El servicio biométrico lo vuelve a verificar contra identity y responde **428 `BIOMETRIC_CONSENT_REQUIRED`** sin autorización vigente, en REST y en WebSocket. Si identity no responde, falla cerrado (503).

## 3. Revocación y supresión

| Requisito | Artículo | Implementación |
|---|---|---|
| Revocar la autorización y pedir la supresión | art. 8-e | Desde el perfil (web y móvil): `DELETE /api/v1/biometric/persons/{id}` borra definitivamente todas las plantillas de rostro y huella (también el historial) y quita la referencia a la persona en los registros de coincidencia; después `DELETE /api/v1/persons/{id}/consent/biometric` registra la revocación (`biometric_revoked_at`). |

Tras revocar, cualquier nuevo registro biométrico vuelve a pedir autorización. Solo el titular o un revisor de su misma sede pueden borrar los datos biométricos.

## 4. Seguridad: cifrado en reposo

El principio de seguridad (art. 4-g) y el deber del art. 17-d piden medidas técnicas que eviten el acceso no autorizado. La ley no fija un algoritmo; se usa **AES-256-GCM**, que es la regla del equipo para datos personales en reposo (`security-rules.md` A02).

| Capa | Qué se cifra | Cómo | Por qué así |
|---|---|---|---|
| PostgreSQL (`identity.person`) | número de documento, correo, teléfono, grupo sanguíneo | `AttributeConverter` JPA en ms-identity, formato `enc:v1:<base64>` | Con la clave fuera de la base, una consulta directa (o un respaldo robado) no revela los datos. El correo y el documento se buscan por un **índice ciego** (HMAC-SHA256 del valor normalizado, `email_hash`, `document_hash`), que conserva el login por correo y la unicidad sin descifrar. El nombre no se cifra: se muestra y se busca en todas las pantallas (ADR-016). |
| MongoDB (biometría) | vector facial y muestra de huella | AES-256-GCM en el servicio biométrico; el `_id` del documento va como dato asociado | MongoDB aquí es community y standalone: el cifrado automático por campo de ADR-016 exige Enterprise o Atlas, por eso el servicio cifra los dos campos. El dato asociado impide copiar un vector cifrado al documento de otra persona. |
| MinIO (soportes) | cada archivo | SSE-S3 con `MINIO_KMS_SECRET_KEY` | Cifrado nativo del almacenamiento de objetos (ADR-009/016). |

Claves (variables de entorno, nunca en el repositorio; `docker compose` no arranca sin ellas):

| Variable | Uso |
|---|---|
| `PII_ENCRYPTION_KEY` | AES-256 de los datos de identidad |
| `PII_HASH_KEY` | HMAC de los índices ciegos |
| `BIOMETRIC_ENCRYPTION_KEY` | AES-256 de plantillas biométricas |
| `MINIO_KMS_SECRET_KEY` | cifrado de los soportes |

Genérelas con `openssl rand -base64 32` (MinIO: `nombre:$(openssl rand -base64 32)`), guárdelas en el gestor de secretos y respáldelas aparte de los datos: sin ellas la información no se puede leer.

## 5. Migración de datos existentes

- **Identity**: al arrancar, `PiiBackfillRunner` cifra e indexa las personas guardadas antes del cifrado (idempotente, por lotes). Mientras tanto se siguen leyendo y el login cae al correo en claro para ellas.
- **Biometría**: una vez desplegado, ejecutar
  `docker exec faceattend-ms-biometric python scripts/encrypt_existing_biometrics.py` (`--dry-run` para solo contar). Mientras tanto los documentos antiguos se siguen leyendo.

## 6. Verificación

- Consulta directa: `select document_number, email from identity.person` devuelve valores `enc:v1:…`; en MongoDB, `db.facial_embeddings.findOne().encoding` es una cadena `enc:v1:…`, no números.
- Pruebas automáticas: `ManageConsentUseCaseImplTest`, `ProvisionUserUseCaseImplTest`, `PiiCipherTest`, `PersonPiiPersistenceTest` (identity); `tests/unit/web/test_ley1581.py` (biometric); `consentApi.test.js`, `staffProvisioning.test.js`, `BiometricEnrollmentModal.test.js` (web); `consentService.test.js`, `userProvisioning.test.js` (móvil).

## 7. Fuera de alcance

- Ninguna respuesta de la API devuelve ya el vector descifrado ni la muestra cruda de huella: `template_response` entrega solo metadatos (id, persona, versión, fecha, dedo). Las rutas de personal por `person_id` (leer, historial, borrar, resumen) están limitadas a la sede de quien llama; el Super Administrador ve todas. Pendiente: la identificación 1:N (`/identify`) y la verificación comparan contra las plantillas de todas las sedes.
- Los respaldos de PostgreSQL y MongoDB contienen los datos ya cifrados, pero el archivo de respaldo en sí no se cifra.
