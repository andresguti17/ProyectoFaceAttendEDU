 # FaceAttendEDU — Mobile (Front-end)

Este repositorio contiene la app móvil de FaceAttendEDU (implementada con Expo / React Native).
Este README amplía la guía de uso, arquitectura, flujos de datos, prácticas recomendadas y comandos de desarrollo.

Índice
- [Resumen rápido](#resumen-rápido)
- [Requisitos](#requisitos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Descripción detallada de carpetas](#descripción-detallada-de-carpetas)
- [Flujo de datos y ejemplo práctico](#flujo-de-datos-y-ejemplo-práctico)
- [Internacionalización y temas](#internacionalización-y-temas)
- [Pruebas, lint y calidad de código](#pruebas-lint-y-calidad-de-código)
- [Construcción y distribución](#construcción-y-distribución)
- [Seguridad y buenas prácticas](#seguridad-y-buenas-prácticas)
- [Depuración y debugging](#depuración-y-debugging)
- [Contribuir](#contribuir)

Resumen rápido
----------------
- Stack: Expo + React Native.
- Estructura modular: UI (`src/view`), presentación (`src/viewmodels`), servicios (`src/services`), transporte (`src/api`), modelos (`src/model`), utilidades (`src/utils`), assets (`src/assets`) y persistencia (`src/storage`).

Requisitos
----------
- Node.js LTS (recomendado >= 16, preferible 18+).
- npm o yarn.
- Expo CLI (opcional globalmente) o usar `npx expo`.

Instalación y ejecución
-----------------------
Instala dependencias:

```bash
npm install
```

Iniciar servidor de desarrollo (Metro / Expo):

```bash
npm expo start
```

Abrir en Android o iOS:

```bash
Escaneando el codigo QR me abre en cualquier de los dispositivos, en este apartado es unicamente para movil.
```

Nota: este proyecto usa Expo (ver `package.json`), por lo que los comandos anteriores ejecutan `expo start`.

Estructura del proyecto
-----------------------
Carpetas principales (ubicadas en `src/`):

- [src/api/README.md](src/api/README.md) — Cliente HTTP y configuración (interceptores, base URL, manejo de errores).
- [src/assets/README.md](src/assets/README.md) — Imágenes, íconos, fuentes y recursos estáticos.
- [src/model/README.md](src/model/README.md) — DTOs, adaptadores y mapeos de respuestas/peticiones.
- [src/navigations/README.md](src/navigations/README.md) — Definición de flujos y stacks de navegación.
- [src/services/README.md](src/services/README.md) — Lógica de integración con la API (orquestación, caching ligero).
- [src/storage/README.md](src/storage/README.md) — Abstracción para persistencia local (tokens, preferencias).
- [src/utils/README.md](src/utils/README.md) — Helpers, hooks y utilidades transversales (i18n, formateos).
- [src/viewmodels/README.md](src/viewmodels/README.md) — Hooks que exponen estado y acciones a las vistas.
- [src/view/README.md](src/view/README.md) — Componentes y pantallas (UI).

Descripción detallada de carpetas
---------------------------------
A continuación encontrarás información ampliada y consejos prácticos por carpeta clave.

- Carpeta raíz (Mobile)
	- Contiene `App.js`, `index.js`, `package.json` y configuraciones globales.
	- `App.js` suele orquestar proveedores (navigation, theme, i18n, context global).
	- Mantén variables de configuración sensibles fuera del repo y usa variables de entorno o servicios de secrets.

- `src/api`
	- Rol: centralizar la comunicación HTTP (ej. `apiClient.js` que envuelve axios o fetch).
	- Responsabilidades: base URL, timeouts, interceptores (agregar token, manejar refresh), normalizar errores.
	- Recomendación: exponer una instancia y/o funciones simples (`get`, `post`, `put`, `delete`) y mockear esta capa en tests.

- `src/assets`
	- Contenido: `images/`, íconos y fuentes.
	- Recomendación: optimizar imágenes, mantener convención de nombres y colocar recursos por tipo/uso.

- `src/model`
	- Rol: DTOs y mapeos. Mantén transformaciones de la API aquí (fechas, nombres de campos).
	- Ventaja: viewmodels y services no repiten parsing.

- `src/navigations`
	- Define `AppNavigator`, stacks de autenticación y rutas protegidas.
	- Buenas prácticas: mantener rutas nombradas y delegar guardas a `viewmodels`.

- `src/services`
	- Contiene la lógica que orquesta llamadas a `api` y manipula `model` y `storage`.
	- Ejemplo: `AuthService.login(credentials)` que llama a `apiClient.post('/auth')` y guarda token en `TokenStorage`.

- `src/storage`
	- Abstracción sobre AsyncStorage o SecureStore. Aquí vive `TokenStorage.js`.
	- Recomendación: usar almacenamiento seguro para tokens en producción (`expo-secure-store` o `react-native-encrypted-storage`).

- `src/utils`
	- Funciones puras, hooks transversales e inicialización de i18n.
	- Ejemplos: `i18n.js`, `getHighestRole.js`, `themeByRole.js`.

- `src/viewmodels`
	- Hooks que exponen `{ data, loading, error, actions }` para las `screens`.
	- Deben ser fácilmente testeables (mockear `services`).

- `src/view`
	- `components/` para piezas reutilizables y `screens/` para pantallas completas.
	- Mantén componentes presentacionales puros y delega la lógica a `viewmodels`.

Flujo de datos
--------------------------------
Flujo típico:

1. El usuario interactúa con una pantalla dentro de `src/view/screens`.
2. La pantalla usa un hook de `src/viewmodels` para ejecutar una acción (p. ej. `useLoginViewModel`).
3. El `viewmodel` llama a un método de `src/services` (p. ej. `AuthService.login`).
4. El `service` usa la instancia de `src/api/apiClient.js` para comunicarse con el backend.
5. Tras una respuesta exitosa, el `service` puede mapear la respuesta usando `src/model` y persistir datos en `src/storage`.
6. El `viewmodel` actualiza su estado y la `view` renderiza la nueva información.

Internacionalización y temas
----------------------------
- Este proyecto usa `i18next` y `react-i18next` (ver `src/utils/i18n.js` y `src/utils/locales`).
- `themeByRole.js` sugiere estilos adaptados por rol; centraliza variables de color y tipografías en un único lugar.

Construcción y distribución
---------------------------
- En desarrollo se usa `expo start` (comandos en `package.json`).
- Para builds de producción usar `EAS Build` (Expo Application Services) o seguir la guía de Expo para `eas build` / `expo build` según la estrategia del equipo.

Seguridad y buenas prácticas
----------------------------
- Tokens: usar almacenamiento seguro (`expo-secure-store`) en vez de dejar tokens en AsyncStorage cuando sea necesario.
- No añadir credenciales en el repo ni en `.env` sin protección.
- Manejar refresh tokens y evitar condiciones de carrera en interceptores HTTP.

- Herramientas: React Native Debugger, Flipper, logs de Expo DevTools. Usar Fast Refresh para ver cambios inmediatamente.
