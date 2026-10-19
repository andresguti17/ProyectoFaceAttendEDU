# Carpeta `src/services`

Propósito:
- Implementa la lógica de negocio relacionada a llamadas a la API, orquestación de múltiples endpoints, caching ligero y transformaciones entre la capa de transporte (`api`) y los `model`.

Archivos representativos en el proyecto:
- `AttendanceService.js`, `AuthService.js`, `UserService.js` — funciones o clases que exponen operaciones reutilizables (login, obtener asistencias, gestionar usuarios).

Responsabilidades típicas:
- Llamar a `api/apiClient.js` para obtener/mandar datos.
- Manejar errores específicos de negocio (reintentos, backoff, validaciones antes de la llamada).
- Devolver objetos ya mapeados o modelos a `viewmodels`.

Buenas prácticas:
- Mantener los `services` puros desde la perspectiva de UI: no deben manipular estado de componentes.
- Documentar contratos de entrada/salida.
- Centralizar la lógica de refresh token en `AuthService` si se requiere.

Interacciones:
- `viewmodels` consumen `services` para obtener datos y acciones.
- `services` usan `api` y `storage` para comunicación y persistencia de credenciales.
