# Diseño S-10: sesión web en cookie HttpOnly

Estado: **opción A elegida el 29 de octubre de 2026** (proxy de `/api` en Vercel, ticket de un solo uso para el WebSocket, `SameSite=Lax`, 8 horas). El PR 1 (identity) está escrito y probado con la suite de identity, sin confirmar en git; los PR 2 a 4 no se han empezado. Hallazgo S-10 del informe de madurez: el token de sesión de la web vive en `sessionStorage`.

## 1. El problema, con lo que hay hoy

- `front-end/Web/src/api/apiClient.js` guarda el `sessionId` en `sessionStorage` (`auth_token`) y lo manda en `Authorization: Bearer` desde un solo punto (línea 244). `authApi.logout` y `biometricSocket.js` también lo usan.
- El `sessionId` es un UUID opaco válido 8 h. Quien lo lea desde JavaScript puede usarlo desde cualquier otro equipo hasta que caduque o se cierre la sesión.
- El WebSocket del kiosco lo manda como subprotocolo (`faceattend.bearer, <token>`) porque el navegador no deja poner cabeceras en el handshake.

## 2. Qué mejora y qué no

| | Con la cookie HttpOnly |
|---|---|
| Un XSS lee el token y lo envía a un servidor del atacante | **Ya no puede**: JavaScript no ve la cookie |
| Un XSS usa la sesión desde la propia página (hace peticiones como el usuario) | **Sigue pudiendo**, mientras la pestaña esté abierta |
| Robo de sesión por un equipo compartido o una extensión que lee `sessionStorage` | Mejora |
| CSRF (otra web hace que el navegador mande la cookie) | **Riesgo nuevo**: hay que mitigarlo (sección 3.3) |

Es una defensa en profundidad. La CSP actual (`script-src 'self'`) sigue siendo la primera barrera contra el XSS.

## 3. Diseño

Solo la web usa la cookie. **La app móvil, los scripts y las llamadas directas entre servicios siguen con `Authorization: Bearer`** y no cambian.

### 3.1 Cookie

`fae_session=<sessionId>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1; Max-Age=28800`

- `Secure` configurable (`SESSION_COOKIE_SECURE`): Chrome acepta `Secure` en `http://localhost`, pero otros entornos de prueba no.
- Sin atributo `Domain`: la cookie queda ligada al host que la fijó.
- `Max-Age` igual a la caducidad de la sesión en identity.

### 3.2 identity (ms-identity)

Cuando la petición trae `X-Session-Mode: cookie`:

- `POST /auth/login`, `/auth/login/verify` y `/auth/refresh` ponen `Set-Cookie` y **quitan `sessionId` del cuerpo** (el resto de la respuesta sigue igual: usuario, caducidad, `mustChangePassword`).
- `POST /auth/refresh` lee la sesión de la cookie cuando no viene en el cuerpo, y fija la cookie nueva.
- `POST /auth/logout` lee la sesión de la cookie y responde `Set-Cookie: fae_session=; Max-Age=0`.
- Sin ese encabezado el comportamiento es el de hoy (móvil y scripts).

### 3.3 Kong (gateway)

En el `post-function` de acceso, antes de leer `Authorization`:

1. Si no hay `Authorization` y hay cookie `fae_session`, copiar su valor a `Authorization: Bearer <valor>` hacia el servicio. Los servicios no cambian.
2. Si la sesión vino de la cookie y el método no es seguro (`POST`, `PUT`, `PATCH`, `DELETE`), exigir **las dos cosas**: cabecera `X-Requested-With: FaceAttend` (obliga a una petición CORS con preflight, que solo pasa desde los orígenes permitidos) y `Origin` (o `Referer`) igual a uno de `KONG_CORS_ORIGINS`. Si falta algo: `403`.
3. WebSocket `/api/v1/biometric/ws`: aceptar la cookie y exigir el mismo `Origin` (evita el secuestro de WebSocket entre sitios). El subprotocolo con el token deja de ser necesario en modo cookie solo si web y API son del mismo sitio (opción B de la sección 4); con el proxy de Vercel (opción A) el WebSocket va directo a la API y usa un ticket de un solo uso.
4. Añadir `X-Requested-With` y `X-Session-Mode` a `headers` del CORS **de cada servicio** de `kong.yml`: los plugins por servicio (hoy `[Authorization, Content-Type]`) sustituyen al global, que solo trae `X-Requested-With`. Sin esto el preflight del navegador falla.

CORS ya tiene `credentials: true` y orígenes explícitos (`__CORS_ORIGINS__`); no debe pasar nunca a `*`.

### 3.4 Web

- `apiClient.js`: `credentials: "include"`, `X-Requested-With: FaceAttend` y `X-Session-Mode: cookie` en cada petición; ya no escribe ni lee el token. Se conserva en `sessionStorage` solo lo que no es secreto (perfil de la sesión y hora de caducidad, para el aviso de sesión por vencer).
- `authApi.logout`: sin cabecera `Authorization`.
- `biometricSocket.js`: abre el WebSocket sin subprotocolo.
- `AuthContext.js`: el estado "sesión iniciada" sale del perfil y la caducidad guardados (no secretos); un `401` en cualquier petición limpia el estado local. Hoy no hay forma de preguntar "¿quién soy?" con la sesión: `GET /auth/me` exige un usuario o correo (responde 400 sin ellos) y `/auth/me/profile` no admite `GET`. Se propone un endpoint nuevo en identity, `GET /auth/session`, que devuelva usuario, estado, caducidad y `mustChangePassword` de la sesión que llega como Bearer (el que Kong inyecta desde la cookie), para validar la sesión al cargar la página.
- Revisar los cuatro archivos que llaman a `fetch` directamente (`cityCatalog.js`, `SearchInput.js`, `useJustificationsViewModel.js`, `useMinorEnrollmentViewModel.js`): ninguno pone `Authorization` hoy, pero los que llaman a la API necesitan `credentials` y la cabecera anti-CSRF.
- Detrás de un interruptor (`EXPO_PUBLIC_SESSION_MODE=cookie`); por defecto sigue el modo actual hasta validarlo.

## 4. Decisiones que hacen falta antes de implementar

1. **Dominio en producción.** La cookie solo viaja bien si la web y la API son del *mismo sitio*. Hoy no lo son: según `DESPLIEGUE.md` la web está en Vercel y llama a `https://faceattend-edu.duckdns.org`. Comprobado en la lista de sufijos públicos (publicsuffix.org, 29 de octubre de 2026): **`vercel.app` y `duckdns.org` son sufijos públicos**, así que cada subdominio de ellos es un sitio distinto. Una web en `<proyecto>.vercel.app` y la API en `faceattend-edu.duckdns.org` son entre sí sitios cruzados, y dos subdominios de DuckDNS tampoco pueden compartir cookies. El navegador trataría la cookie como de terceros y la bloquearía (con `SameSite=None; Secure` funcionaría en unos navegadores y en otros no). Tres salidas:
   - **A. Proxy en Vercel**: `vercel.json` reescribe `/api/*` hacia la API, de modo que el navegador solo habla con el dominio de la web y la cookie es de primera parte. Sin coste, pero Vercel no reenvía WebSockets: el kiosco biométrico seguiría yendo directo a la API y necesitaría un **ticket de un solo uso** (`POST /auth/ws-ticket`, caduca en segundos, se manda como subprotocolo) en lugar del token. Añade carga y latencia por el salto extra y hay que repasar la CSP (`connect-src`).
   - **B. Dominio propio**: un dominio real con `app.<DOMAIN>` para la web (Vercel admite dominios propios) y `api.<DOMAIN>` para la API (ya previsto en `Caddyfile.prod`). Es lo más limpio y también resuelve el WebSocket (la cookie viaja en el mismo sitio), pero cuesta un dominio.
   - **C. No hacerlo**: dejar el token en `sessionStorage` y apoyarse en la CSP estricta que ya existe (`script-src 'self'`, sin `unsafe-inline` en scripts). S-10 es de severidad media y depende de que exista un XSS.
2. **`SameSite=Lax` o `Strict`.** `Lax` permite entrar siguiendo un enlace externo (por ejemplo desde un correo); `Strict` lo impediría. Se propone `Lax` más la comprobación de `Origin`.
3. **Duración.** Se mantienen las 8 h actuales; con `refresh` de un solo uso se puede acortar después.

## 5. Plan en cuatro PR, con vuelta atrás en cada uno

1. **identity**: modo cookie en login, verify, refresh y logout y el endpoint `GET /auth/session`, con tests (cookie fijada y borrada, cuerpo sin `sessionId`, modo bearer sin cambios).
2. **Kong**: traducción cookie a `Authorization`, comprobación de `Origin` y de la cabecera anti-CSRF, WebSocket. Probado con peticiones reales contra el gateway (casos de la sección 6).
3. **Web, tras el interruptor**: apiClient, authApi, WebSocket, AuthContext y sus tests.
4. **Limpieza**: activar el modo cookie por defecto y borrar el código del token en `sessionStorage`.

Vuelta atrás: apagar el interruptor de la web (los otros tres cambios son compatibles con el modo bearer).

## 6. Pruebas

- **Kong (casos con `curl`)**: solo cookie en un `GET` funciona; solo cookie en un `POST` sin `X-Requested-With` da `403`; con `Origin` ajeno da `403`; con `Authorization: Bearer` (móvil) todo sigue igual; cookie con un UUID inventado da `401`; WebSocket con y sin `Origin` válido.
- **identity**: tests unitarios de los cuatro endpoints en ambos modos.
- **Web**: tests de Jest; `verificar-estado.mjs` con login por formulario y botones; revisión manual: en las herramientas del navegador la cookie aparece como `HttpOnly`, `document.cookie` no la muestra y `sessionStorage` no contiene el token.
- **Móvil**: la prueba de que sigue funcionando es un login y una consulta por Bearer.

## 7. Riesgos

- Mezclar los dos modos en un mismo navegador (cookie y token a la vez): Kong da prioridad a `Authorization`.
- Cerrar sesión en una pestaña mientras otra sigue abierta: la otra recibe `401` en la siguiente petición y vuelve al login.
- Un proxy o CDN que elimine la cabecera `Cookie`: se detecta con la prueba de punta a punta en el entorno real.
- Las pruebas E2E que usan el formulario seguirán funcionando; las que leen el token de `sessionStorage` dejarán de hacerlo.

## 8. Fuera de alcance

Mover la sesión a JWT, cambiar a refresh tokens rotatorios o proteger de otra forma al XSS que usa la sesión desde la propia página: requieren otra discusión.
