# Trazabilidad requisito → implementación → prueba

> Requisitos tomados del *Informe de especificación de requisitos* (carpeta del equipo
> `DOCUMENTACION/FaceAttendEDU-RAPS/01-Informe de especificación de requisitos/`, fuera de este repositorio),
> sección «Matriz de trazabilidad de requisitos» y «Requisitos no funcionales derivados».
>
> **Cómo se armó:** cruzando cada requisito con las rutas de los controladores y routers y con el nombre y los
> títulos (`@Test`, `it`, `test`, `def test_`) de las pruebas del repositorio. No se ejecutaron las pruebas para
> este documento ni se midió cobertura: una fila «Cubierto» dice que existe una prueba que ejercita ese
> comportamiento, no que el requisito se cumpla en todos sus criterios de aceptación.
>
> **Un hueco se deja como hueco.** No se escribieron pruebas para rellenar esta tabla.

## Leyenda

Estado:

- **Cubierto**: hay implementación y al menos una prueba automática del comportamiento principal.
- **Parcial**: hay implementación y pruebas, pero falta una parte del requisito o de sus reglas (se dice cuál).
- **Hueco**: la implementación existe pero ninguna prueba la cubre, **o** el requisito no está implementado
  (se dice cuál de los dos).

Dónde están las pruebas (el prefijo entre corchetes de la columna «Pruebas»):

| Prefijo | Ruta |
|---|---|
| `[identity]` | `back-end/01-ms-identity/src/test/java/**` |
| `[authorization]` | `back-end/02-ms-authorization/src/test/java/**` |
| `[academic]` | `back-end/03-ms-academic/src/**/__tests__/` |
| `[scheduling]` | `back-end/04-ms-scheduling/src/test/java/**` |
| `[attendance]` | `back-end/05-ms-attendance/src/test/java/**` |
| `[biometric]` | `back-end/06-ms-biometric/tests/` |
| `[configuration]` | `back-end/07-ms-configuration/src/**/__tests__/` |
| `[notification]` | `back-end/08-ms-notification/src/**/__tests__/` |
| `[gateway]` | `back-end/99-api-gateway/tests/` |
| `[web]` | `front-end/Web/src/**/__tests__/` |
| `[móvil]` | `front-end/Mobile/src/**/__tests__/` |
| `[e2e]` | `tools/e2e/` (scripts contra un stack levantado, no corren en CI) |

Las rutas de API son las de Kong (`/api/v1/...`).

## 1. Requisitos funcionales

### RF 1 Gestión de usuarios

| ID | Requisito | Endpoint / pantalla | Pruebas | Estado |
|---|---|---|---|---|
| ERF 1.1 | Registrar usuarios | `POST /api/v1/persons`, `POST /api/v1/users`, `POST /api/v1/users/provision`; web: modales de usuarios | `[identity]` CreatePersonUseCaseImplTest, PersonValidationTest, CreateUserUseCaseImplTest, ProvisionUserUseCaseImplTest, PersonControllerTest, UserControllerTest · `[web]` useUsersViewModelRegister.test, UserModals.test, staffProvisioning.test · `[móvil]` userProvisioning.test · `[e2e]` user-provisioning-rollback.mjs | Cubierto |
| ERF 1.1.1 | Asignación de roles | `POST/GET/DELETE /api/v1/users/{userId}/roles` | `[authorization]` AssignRoleToUserUseCaseImplTest, UserRoleControllerTest, UserRoleJpaRepositoryTest | Cubierto |
| ERF 1.1.2 | Asignación de permisos | `POST/GET/DELETE /api/v1/roles/{roleId}/permissions`, `GET /api/v1/auth/evaluate` | `[authorization]` AssignPermissionToRoleUseCaseImplTest, CheckPermissionUseCaseImplTest, PermissionControllerTest, RoleControllerTest | Cubierto |
| ERF 1.2 | Registro masivo CSV | web: `ImportStudentsModal` (CSV y .xlsx) → creación por lotes | `[web]` ImportStudentsModal.test (comas, punto y coma, BOM, comillas, filas incompletas), batching.test, useUsersViewModel.test («importUsers») | Cubierto |
| ERF 1.3 | Inicio de sesión (móvil) | `POST /api/v1/auth/login`, `/auth/login/verify` (2FA), `/auth/refresh`; móvil: pantalla de login | `[identity]` AuthenticateUserUseCaseImplTest, AuthControllerTest, AuthControllerSessionCookieTest, TwoFactorUseCasesTest, RefreshSessionUseCaseImplTest, RedisLoginAttemptAdapterTest · `[móvil]` twoFactorLogin.test, sessionRefresh.test, loginTermsGate.test · `[web]` useAuthViewModel.test, AuthContext.restore.test · `[gateway]` cookie-session.sh | Cubierto |
| ERF 1.4 | Recuperación de contraseña | `POST /api/v1/auth/forgot-password`, `/verify-code`, `/reset-password` | `[identity]` RequestPasswordRecoveryUseCaseImplTest, VerifyRecoveryCodeUseCaseImplTest, ResetPasswordUseCaseImplTest, PasswordRecoveryControllerTest, RedisRecoveryCodeAdapterTest · `[web]` useRecoveryViewModel.test | Parcial: sin prueba del flujo en la app móvil |
| ERF 1.5 | Cambio de contraseña | `POST /api/v1/auth/change-password` | `[identity]` ChangePasswordUseCaseImplTest, PasswordPolicyTest · `[web]` useChangePasswordViewModel.test · `[móvil]` forcedPasswordChange.test | Cubierto |
| ERF 1.6 | Activar o desactivar usuarios | `PATCH /api/v1/users/{id}/status`, `POST /api/v1/users/{id}/activate` | `[identity]` UserActivationServiceTest, IdentityMaintenanceUseCasesTest · `[web]` useUsersViewModel.test («toggles status», «bulkUpdateUsers») | Cubierto |
| ERF 1.7 | Eliminar usuarios | borrado lógico: en la web «eliminar» desactiva (`deleted_at`, `status=false`) | `[web]` useUsersViewModel.test («delete is a soft deactivation») | Parcial: solo la web; ninguna prueba del backend comprueba que el borrado de un usuario sea lógico |
| ERF 1.8 | Consulta de información del usuario | `GET /api/v1/auth/me`, `PUT /api/v1/auth/me/profile`, `GET /api/v1/persons/{id}` | `[identity]` ProfileControllerTest, UpdateOwnProfileUseCaseImplTest · `[web]` useProfileViewModel.test, profileForm.test · `[móvil]` profileData.test | Cubierto |

### RF 2 Gestión de ambientes

| ID | Requisito | Endpoint / pantalla | Pruebas | Estado |
|---|---|---|---|---|
| ERF 2.1 | Registrar ambientes | `/api/v1/environments` | `[scheduling]` EnvironmentControllerTest, SchedulingPersistenceTest · `[web]` environmentManagement.test | Cubierto |
| ERF 2.2 | Registrar fichas o cursos | `/api/v1/cohorts`, `/api/v1/programs/{programId}/cohorts` | `[academic]` routes.test, academic.test, crud.repository.test | Cubierto |
| ERF 2.3 | Asignar responsables | instructor del bloque horario (`schedule_block.instructor_actor_id`) | `[scheduling]` ScheduleBlockControllerTest, ScheduleBlockOverlapGuardTest («instructor busy») | Parcial: no hay responsable de ambiente ni suplentes, ni vigencia de la asignación |
| ERF 2.3.1 | Asignar fichas | `POST /api/v1/enrollments` (actor ↔ ficha) | `[academic]` enrollment.repository.test (sin duplicados, restaura el borrado) | Parcial: cubre la matrícula del aprendiz; la asignación de una ficha a un responsable no existe como tal |
| ERF 2.3.2 | Asignar jornadas | `/api/v1/schedule-blocks`, `/api/v1/class-sessions` | `[scheduling]` CreateScheduleBlockUseCaseImplTest, ScheduleBlockOverlapGuardTest, ScheduleBlockOverlapPersistenceTest, ScheduleBlockTest, ClassSessionTransitionsTest · `[web]` scheduleBlockManagement.test | Cubierto |

### RF 3 Registros de entrada y salida

| ID | Requisito | Endpoint / pantalla | Pruebas | Estado |
|---|---|---|---|---|
| ERF 3.1 | Registrar ingresos y salidas | `POST /api/v1/attendance-records`; web: kiosco `/app/biometrics/...` | `[attendance]` AttendanceRecordControllerTest, AttendanceUniquenessTest, ArrivalStatusPolicyTest, RemoteArrivalTimingTest · `[web]` useAttendanceKioskViewModel.test, AttendanceKioskScreen.test | Parcial: se registra la llegada (presente/tarde), **no la salida**; el modelo no tiene dirección entrada/salida |
| ERF 3.1.1 | Registro facial | `POST /api/v1/biometric/facial/enroll-image`, `/identify-image`, `/liveness-*`, WebSocket `/api/v1/biometric/ws` | `[biometric]` test_facial_image_endpoints, test_facial_embedding, test_face_threshold, test_liveness_gestures, test_liveness_hardening, test_match_scope, test_ws_router · `[web]` useFaceCapture.test, useBiometricsViewModel.test · `[móvil]` faceLivenessEnrollment.test · `[gateway]` ws-ticket.mjs | Parcial: en el móvil solo se inscribe el rostro; la identificación para asistencia la hace el kiosco web (DESPLIEGUE §19.4) |
| ERF 3.1.2 | Registro alterno con huella | `/api/v1/biometric/fingerprint/*` | `[biometric]` test_fingerprint_sample_endpoints · `[web]` useFingerprintReader.test, fingerprintQuality.test, AttendanceKioskScreen.test («kiosk fingerprint capture») | Parcial: la requisición pide móvil; la huella solo existe en la web con lector DigitalPersona |
| ERF 3.2 | Control de personal no registrado | — | — | Hueco: no implementado |
| ERF 3.2.1 | Registro alternativo temporal | registro manual del instructor (`captureMethod=MANUAL`) | `[attendance]` ManualAttendanceWithoutBiometricsTest | Parcial: cubre a quien no tiene biometría; no hay credencial temporal |

### RF 4 Configuración del sistema

| ID | Requisito | Endpoint / pantalla | Pruebas | Estado |
|---|---|---|---|---|
| ERF 4.1 | Configurar alertas (móvil) | `/api/v1/alerts`, `/api/v1/alert-types`; móvil: ajustes | `[notification]` routes.alerts.test, routes.alertTypes.test, attendanceAlerts.test · `[móvil]` alertFeed.test, pushService.test · `[web]` useAlertsViewModel.test | Cubierto |
| ERF 4.1.1 | Activar o desactivar alertas | móvil: un interruptor por tipo de alerta | `[móvil]` LanguageSettingsScreen.test («one switch per alert kind») | Cubierto |
| ERF 4.1.2 | Cambio de tono | — | — | Hueco: no implementado |
| ERF 4.2 | Configurar idiomas | web y móvil: selector de idioma | `[web]` LanguageContext.test, locales.test, locale.test | Parcial: sin prueba del cambio de idioma en el móvil |
| ERF 4.3 | Actualización de paletas | tema por rol y paletas | `[móvil]` palettes.contrast.test, themeByRole.test, colorUtils.golden.test · `[web]` colorUtils.golden.test, buttonColors.test | Parcial: hay paletas por rol y su contraste; no se encontró prueba de que el usuario elija una paleta |
| ERF 4.4 | Parámetros del usuario | `/api/v1/academic-configurations`, `/api/v1/security-configurations`; perfil | `[configuration]` routes.test · `[web]` settingsPersistence.test, RoleSettings.render.test | Parcial: cubre la configuración de sede y de seguridad; la reautenticación para cambios sensibles no tiene prueba |
| ERF 4.5 | Alertas de fallos IoT | — | — | Hueco: no hay infraestructura IoT en el sistema |
| ERF 4.6 | Cambio de rol | `POST/DELETE /api/v1/users/{userId}/roles` | `[authorization]` AssignRoleToUserUseCaseImplTest, UserRoleControllerTest · `[móvil]` roleService.test | Cubierto |
| ERF 4.7 | Parametrización de retardos y justificaciones | configuración `tardy_tolerance_minutes`; `/api/v1/justification-types` | `[attendance]` ArrivalStatusPolicyTest (tolerancia), CreateJustificationTypeUseCaseImplTest, JustificationTypeControllerTest · `[configuration]` routes.test | Cubierto |

### RF 5 Históricos

| ID | Requisito | Endpoint / pantalla | Pruebas | Estado |
|---|---|---|---|---|
| ERF 5.1 | Asistencias e inasistencias por parámetros (móvil) | `GET /api/v1/attendance-records?...`, `GET /api/v1/academic-actors/{id}/attendance` | `[attendance]` AttendanceRecordSearchTest (paginación, filtros, alcance) · `[móvil]` attendanceFilters.test · `[web]` HistoricalSection.render.test | Cubierto |
| ERF 5.2 | Historial de cambios del usuario | — | — | Hueco: no implementado. Las tablas guardan `created_by`/`updated_by`/`row_version`, pero no hay bitácora de valores anterior y nuevo (el contexto Audit se retiró del modelo) |

### RF 6 Justificaciones

| ID | Requisito | Endpoint / pantalla | Pruebas | Estado |
|---|---|---|---|---|
| ERF 6.1 | Carga de soportes | `POST /api/v1/justifications`, `POST /api/v1/justifications/{id}/documents` (multipart) | `[attendance]` UploadSupportingDocumentUseCaseImplTest, SupportingDocumentControllerTest, JustificationDocumentControllerTest, MinioDocumentStorageAdapterTest · `[móvil]` justificationDocumentUpload.test, justificationEligibility.test · `[web]` apiClientFiles.test · `[e2e]` justification-upload.mjs | Cubierto |
| ERF 6.2 | Aprobación y rechazo | `PATCH /api/v1/justifications/{id}/review` | `[attendance]` JustificationReviewTest, JustificationControllerTest · `[móvil]` justificationReview.test | Cubierto |
| ERF 6.3 | Notificación del resultado | evento `JustificationReviewed` → alerta | `[notification]` justification.consumer.test, notifier.test, sender.test | Cubierto |

### RF 7 Reportes

| ID | Requisito | Endpoint / pantalla | Pruebas | Estado |
|---|---|---|---|---|
| ERF 7.1 | Exportar reporte | `/api/v1/attendance-reports` (CSV); web: exportación a Excel/CSV | `[attendance]` AttendanceReportTest («csvHasATotalLine…»), AttendanceReportControllerTest · `[web]` exportHelpers.excel.test, exportHelpers.escaping.test | Cubierto |
| ERF 7.2 | Dashboard analítico | web: inicio / dashboard | `[web]` DashboardView.render.test, useDashboardViewModel.test, dashboardSeries.test | Cubierto |
| ERF 7.3 | Reportes por rango de fechas | `/api/v1/attendance-reports` con filtros; web: reportes | `[attendance]` AttendanceReportTest, AttendanceReportPersistenceTest · `[notification]` periodReport.test · `[web]` AdminReports.render.test, FilterBars.render.test | Cubierto |
| ERF 7.4 | Consulta de retardos e inasistencias por parámetros | `GET /api/v1/attendance-records?attendanceStatus=...` | `[attendance]` AttendanceRecordSearchTest («combinesFilters») · `[móvil]` attendanceFilters.test | Cubierto |

### RF 8 Gestión del colegio

| ID | Requisito | Endpoint / pantalla | Pruebas | Estado |
|---|---|---|---|---|
| ERF 8.1 | Agregar o eliminar cursos | `/api/v1/courses`, `/api/v1/programs/{programId}/courses` | `[academic]` routes.test, crud.repository.test · `[web]` courseCreation.test, ImportCoursesModal.test | Cubierto |
| ERF 8.2 | Plan de estudios | programa → materias (`credit_hours`) | `[academic]` routes.test | Hueco: no hay plan versionado, secuencia ni prerrequisitos; solo la relación programa–materia |

## 2. Requisitos no funcionales

| Código | Requisito | Dónde se implementa | Pruebas | Estado |
|---|---|---|---|---|
| NFR-SEG-01 | Autenticación y autorización | sesión opaca validada por identity; RBAC en cada servicio; Kong | `[identity]` AuthTokenFilterTest, SessionTokenHasherTest · `[authorization]` AuthTokenFilterFlowTest · `back-end/shared` SessionAuthClientTest · `[biometric]` test_security · `[gateway]` cookie-session.sh, ws-ticket.mjs · `[notification]` authGuard.integration.test | Cubierto (con tokens opacos, no firmados como dice el criterio) |
| NFR-SEG-02 | Inyección y XSS | validación en servicios; CSP en `vercel.json` | `[identity]` PersonValidationTest · `[web]` exportHelpers.escaping.test, linearRegex.test | Parcial: sin prueba automática de la CSP |
| NFR-PRIV-01 | Datos biométricos seguros | AES-256-GCM, consentimiento | `[biometric]` test_ley1581, test_enablement · `[identity]` PiiCipherTest, ManageConsentUseCaseImplTest, PersonPiiPersistenceTest | Parcial: la retención de plantillas no está definida (REGISTRO_RIESGOS B-07) |
| NFR-PRIV-02 | Minimización en logs | enmascarado de correos y tokens | `[identity]` LogMaskTest · `[notification]` logMask.test | Cubierto |
| NFR-PERF-01 | Login móvil P95 ≤ 3 s | — | — | Hueco: sin prueba de rendimiento |
| NFR-PERF-02 | Registro de asistencia < 5 s | — | — | Hueco: sin prueba de rendimiento |
| NFR-PERF-03 | Históricos paginados | paginación en la búsqueda de asistencia | `[attendance]` AttendanceRecordSearchTest («pagesWithArbitraryOffset») | Parcial: hay paginación; no hay prueba de tiempo de respuesta |
| NFR-AVL-01 | Disponibilidad | `tools/monitor/check.sh` | — | Hueco: sin objetivo acordado ni medición (REGISTRO_RIESGOS O-06, O-07) |
| NFR-USU-01 | Menos de cinco pasos para marcar asistencia | — | — | Hueco: sin prueba |
| NFR-ACC-01 | WCAG 2.2 básico | contraste de paletas | `[móvil]` palettes.contrast.test · `[web]` getTextOnColor.test, textTertiary.test | Parcial: solo contraste; sin pruebas de teclado ni etiquetas |
| NFR-MNT-01 | Modularidad | un servicio por contexto | (cada servicio tiene su propia suite) | Cubierto |
| NFR-PORT-01 | Android e iOS | app Expo | — | Hueco: solo se genera APK; versiones mínimas no definidas (DESPLIEGUE §19.5) |
| NFR-AUD-01 | Log inmutable de cambios críticos | — | — | Hueco: igual que ERF 5.2 |
| NFR-IOT-01 | Heartbeat IoT | — | — | Hueco: no hay IoT |

## 3. Resumen de huecos

No implementados: ERF 3.2, 4.1.2, 4.5, 5.2, 8.2 (salvo la relación programa–materia), NFR-AUD-01, NFR-IOT-01.
Implementados sin prueba: rendimiento (NFR-PERF-01/02), disponibilidad, usabilidad y portabilidad.
Parciales con una regla concreta sin cubrir: salida en ERF 3.1, borrado lógico del backend en ERF 1.7,
responsables y vigencias en ERF 2.3 y 2.3.1, idioma en el móvil (ERF 4.2), reautenticación (ERF 4.4).

`TODO`: decidir con el equipo qué huecos se cierran con pruebas, cuáles se sacan del alcance del informe de
requisitos y cuáles quedan como trabajo futuro.
