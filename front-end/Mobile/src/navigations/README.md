# Carpeta `src/navigations`

Propósito:
- Centralizar la configuración de la navegación de la app (stacks, tabs, flows de autenticación, deep linking y guardas de rutas).

Archivo destacado:
- `AppNavigator.js` — punto principal donde se definen las rutas y flujos (login vs app autenticada).

Qué contiene normalmente:
- Definiciones de stacks y tabs.
- Middleware o listeners para detectar cambios de estado de navegación.
- Integración con `viewmodels` para proteger rutas (p. ej. verificar rol/permiso antes de permitir acceso).

Buenas prácticas:
- Separar el flujo de autenticación del flujo principal (p. ej. `AuthStack` y `MainStack`).
- Evitar lógica de negocio en el navigator; delegarla a `viewmodels` o `services`.
- Mantener las rutas nombradas y centralizadas para facilitar deep linking y testeo.

Interacciones con otras carpetas:
- `view` provee los `screens` que el navigator renderiza.
- `storage/TokenStorage.js` y `viewmodels` ayudan a decidir si el usuario está autenticado y qué stack mostrar.
