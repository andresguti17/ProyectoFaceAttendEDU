# Build context: back-end/ (package.json links ../shared/auth-node, which lands at /shared).
FROM node:24-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS builder
COPY shared/auth-node /shared/auth-node
WORKDIR /app
COPY 09-ms-quality/package*.json ./
RUN npm ci --ignore-scripts
COPY 09-ms-quality/ .
RUN npm run build

FROM node:24-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c
RUN apt-get update && apt-get install -y --no-install-recommends wget curl && rm -rf /var/lib/apt/lists/*
COPY shared/auth-node /shared/auth-node
WORKDIR /app
COPY 09-ms-quality/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN chown -R node:node /app
USER node
ENV PORT=8089
EXPOSE 8089
CMD ["node","dist/main.js"]
