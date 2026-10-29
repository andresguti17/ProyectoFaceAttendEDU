# ============================================================
#  FaceAttend EDU — Frontend Web (Expo Web estático + nginx)
#  Build: expo export --platform web → dist/ → nginx :8080 (sin root)
#  Backend: EXPO_PUBLIC_API_URL es opcional. Si no se pasa, el
#  bundle infiere el host de Kong a partir de location.hostname
#  en runtime (src/config/env.ts) en vez de hornear "localhost",
#  que solo funciona cuando el navegador corre en la misma
#  máquina que el gateway.
# ============================================================
FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
WORKDIR /app
ARG EXPO_PUBLIC_API_URL=
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
# S-10: "cookie" = la sesión vive en una cookie HttpOnly (sin token en JavaScript). WS_URL: API directa para el
# WebSocket del kiosco cuando REST pasa por el proxy de Vercel (que no reenvía WebSockets).
ARG EXPO_PUBLIC_SESSION_MODE=
ENV EXPO_PUBLIC_SESSION_MODE=${EXPO_PUBLIC_SESSION_MODE}
ARG EXPO_PUBLIC_WS_URL=
ENV EXPO_PUBLIC_WS_URL=${EXPO_PUBLIC_WS_URL}
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . ./
# El SDK DigitalPersona (huella) se copia a public/vendor y Expo lo incluye en dist/.
RUN node scripts/copy-digitalpersona.mjs && ./node_modules/.bin/expo export --platform web

# Sin root: la imagen unprivileged corre nginx como usuario nginx (uid 101) en :8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine@sha256:65e3e85dbaed8ba248841d9d58a899b6197106c23cb0ff1a132b7bfe0547e4c0 AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
# HEALTHCHECK: nginx escucha solo IPv4, por eso se usa 127.0.0.1 y no
# `localhost` (que dentro del contenedor resuelve también a ::1 y es rechazado).
HEALTHCHECK --interval=20s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/ || exit 1
