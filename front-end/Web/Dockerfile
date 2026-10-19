# ============================================================
#  FaceAttend EDU — Frontend Web (Expo Web estático + nginx)
#  Build: expo export --platform web → dist/ → nginx :80
#  Backend: EXPO_PUBLIC_API_URL es opcional. Si no se pasa, el
#  bundle infiere el host de Kong a partir de location.hostname
#  en runtime (src/config/env.ts) en vez de hornear "localhost",
#  que solo funciona cuando el navegador corre en la misma
#  máquina que el gateway.
# ============================================================
FROM node:20-alpine AS build
WORKDIR /app
ARG EXPO_PUBLIC_API_URL=
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . ./
# El SDK DigitalPersona (huella) se copia a public/vendor y Expo lo incluye en dist/.
RUN node scripts/copy-digitalpersona.mjs && npx expo export --platform web

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# HEALTHCHECK: nginx escucha solo IPv4, por eso se usa 127.0.0.1 y no
# `localhost` (que dentro del contenedor resuelve también a ::1 y es rechazado).
HEALTHCHECK --interval=20s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1
