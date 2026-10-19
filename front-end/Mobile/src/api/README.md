# Carpeta `src/api`

Propósito:
- Contiene el cliente HTTP y configuraciones relacionadas con las llamadas al backend. Aquí se define la base URL, interceptores (autorización, refresco de token), timeouts y manejo global de errores.

Archivo clave en este proyecto:
- `apiClient.js` — cliente HTTP central (axios/fetch wrapper).

Qué incluye y por qué:
- Configuración de la base URL y headers por defecto.
- Interceptores para adjuntar el token desde `storage/TokenStorage.js`.
- Manejadores comunes de errores (transformación de mensajes de error legibles para `services`).

Cómo se usa:
- Los `services` importan las funciones o instancia exportada desde `apiClient.js` para realizar peticiones (GET/POST/PUT/DELETE).

Seguridad:
- Nunca loggear tokens en producción.
- Soportar refresh token con cuidado, evitando condiciones de carrera en interceptores.
