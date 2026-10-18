# Carpeta `src/storage`

Propósito:
- Proveer una capa de persistencia local (tokens, preferencias, cachés pequeños) con una API clara e intercambiable.

Archivo principal en este proyecto:
- `TokenStorage.js` — abstracción para guardar/obtener/eliminar tokens de autenticación.
  - Nativo: `expo-secure-store` (keystore / Keychain). Web o si el keystore no está
    disponible: `AsyncStorage`. Las sesiones guardadas antes del keystore se migran
    automáticamente al leerlas.
  - Payload con forma compartida con Web: `{ token, savedAt, expiresAt, email }`.
  - API: `saveToken(token, email?)`, `getToken()`, `removeToken()`, `hasValidToken()`.

Qué debe manejar la carpeta:
- Abstraer detalles de implementación (AsyncStorage, SecureStore, MMKV) para que el resto de la app no dependa de la librería concreta.
- Encriptación opcional para datos sensibles.

Recomendaciones:
- No guardar información sensible sin cifrar (usar mecanismos seguros en producción).
- Exponer métodos claros: `getToken()`, `setToken()`, `removeToken()`, `getUserPreferences()`.
- Manejar errores y condiciones offline.

Integración:
- `services` y `api` usan `storage` para obtener tokens y datos persistentes.
- `viewmodels` pueden leer preferencias (idioma, tema) desde `storage` al inicializar.
