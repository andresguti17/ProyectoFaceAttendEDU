---
name: faceattend-frontend-mvvm
description: Use when adding a screen, viewmodel, or API-backed feature in front-end/Web or front-end/Mobile (Expo/React Native), or wiring facial/fingerprint capture on the client.
---

# Frontend MVVM (Web + Mobile, Expo/React Native)

## Overview
`front-end/Web` y `front-end/Mobile` son apps Expo + React Native (Web también renderiza en navegador vía `react-native-web`). Ambas siguen un patrón MVVM explícito (`Web/ARQUITECTURA_MVVM.md`): `view/` → `viewmodels/` (hooks `use*ViewModel.js`) → `services/`/`api/`. Estado global vía Context API (`context/` en Web, archivos sueltos como `utils/UserContext.js` en Mobile) — **no hay Redux ni Zustand**, no los introduzcas.

## Cuándo usar
Vas a crear/editar una pantalla, un hook `use*ViewModel`, un servicio que llama al backend, o a integrar cámara/huella.

## Convenciones verificadas
- Estructura compartida: `view/screens|components/`, `viewmodels/use*ViewModel.js`, `api/apiClient.js`, `models/`.
- Diferencias reales entre apps (no asumas que son iguales):
  - Navegación: carpeta `navegation/` en Web (sic, sin "i") vs `navigations/` en Mobile.
  - Servicios: Web los agrupa en `services/api/`; Mobile tiene 30+ archivos planos en `services/` (uno por entidad, ej. `AuthService.js`, `FaceAuthService.js`).
  - Theming: Web tiene `core/theme/` dedicado (`colorTokens.js`, `generateTheme.js`, `presets.js`); Mobile no tiene carpeta `theme/`, los tokens viven en `utils/colorPresets.js`, `colorUtils.js`, `themeByRole.js`.
  - Lint: Web tiene `eslint.config.js` (`eslint-config-expo/flat`) + `npm run lint`; **Mobile no tiene lint configurado** (no inventes un comando `lint` para Mobile).
- `apiClient.js` (ambas apps, `Web/src/api/apiClient.js` y `Mobile/src/api/apiClient.js`): `fetch` + `AbortController` (no axios, aunque axios esté listado en deps de Mobile — no se usa en el cliente principal). Adjunta `Authorization: Bearer <sessionId>` leído de storage (`localStorage` en Web, `AsyncStorage`/`TokenStorage.js` en Mobile); desenvuelve `{data,meta}`; reintenta una vez en GET ante error de red; dedupe de GETs en vuelo; callback de 401 (`setUnauthorizedHandler`/`onSessionExpired`) purga sesión, excepto en `/api/v1/auth/*`. Mobile además traduce endpoints legacy vía `LEGACY_ENDPOINT_MAP`.
- Config de entorno: `Web/src/config/env.ts` resuelve `EXPO_PUBLIC_API_URL` o infiere host/puerto 8000 desde `window.location.hostname`; override runtime `window.__FACEATTEND_API_URL__`. `Mobile/src/config/env.js` usa `expo-constants` (`Constants.expoConfig.hostUri`), `10.0.2.2` para emulador Android, fallback LAN hardcodeado `192.168.1.2`, override por `EXPO_PUBLIC_API_URL`.
- Captura biométrica:
  - Mobile: `expo-camera` (`CameraView`) en `view/screens/RegisterFace.js` + `viewmodels/useRegisterFaceScreenViewModel.js`, llama `services/FaceAuthService.js` (`/facial/enroll-image`, `/facial/identify-image`, `/facial/liveness-challenge`, `/facial/liveness-step`, `/fingerprint/*`).
  - Web: `getUserMedia` nativo (no expo-camera) en `viewmodels/useFaceCapture.js` ("solo web"), liveness por gestos aleatorios (6 frames/gesto contra `/liveness-step`), landmarks/detección con `@vladmandic/face-api` en `view/components/students/FaceRegistrationModal/faceApiUtils.js` (modelos `ssdMobilenetv1`, `faceLandmark68Net`, `faceRecognitionNet`). Huella en Web vía `@digitalpersona/fingerprint` + `@digitalpersona/websdk`, vendorizados por `scripts/copy-digitalpersona.mjs` (corre en `prestart`/`preweb` — no vendorices esos archivos a mano).
- Testing: Jest + `jest-expo` (`jest-expo/web` en Web). Ejemplos reales: `Mobile/src/api/__tests__/apiClient.test.js`, `Web/src/viewmodels/__tests__/useAuthViewModel.test.js`.

## Guía
1. Pantalla nueva → crea su `use*ViewModel.js` en `viewmodels/`, la vista en `view/screens/`, y si llama al backend, un método en el `service` correspondiente (o `services/api/` en Web) que use el `apiClient` existente — no hagas `fetch` suelto en la vista.
2. Si la feature toca cámara/biometría, reutiliza el flujo de liveness ya existente (gestos aleatorios + `/liveness-step`) en vez de diseñar uno nuevo.
3. Antes de usar un color/token de diseño, verifica el valor real en `Web/src/core/theme/colorTokens.js`/`presets.js` (o `Mobile/src/utils/colorPresets.js`) — **no copies valores de `fae-docs/12-ux-ui/README.md` ni de `design-system.md`: ambos documentan paletas distintas entre sí y pueden no coincidir con el código actual.**

## Restricciones
- No introduzcas Redux/Zustand/MobX; el patrón de estado es Context + hooks.
- No muestres ni loguees datos biométricos crudos (imagen, plantilla) en ninguna vista o consola (Ley 1581/2012 + GDPR).
- No vendorices manualmente los SDK de DigitalPersona; usa `scripts/copy-digitalpersona.mjs`.

## Verificación
```bash
cd front-end/Mobile && npm ci && npm test
cd front-end/Web && npm ci && npm test && npx expo export --platform web
```
Mismo que los jobs `mobile`/`web` de `.github/workflows/ci.yml`.

## Dudas/pendientes
- No confirmado si Storybook (`storybook:ios`/`storybook:android` en `Web/package.json`) está realmente configurado (no se halló carpeta `.storybook/`).
- No confirmado si `axios` (dependencia de Mobile) se usa en algún punto fuera de `apiClient.js`.
- No hay Prettier configurado en ninguna de las dos apps (no inventes un comando `format`).
