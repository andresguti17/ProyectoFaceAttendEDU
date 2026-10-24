# Build context: back-end/ (package.json links ../shared/auth-node, which lands at /shared).
FROM node:20-slim AS builder
COPY shared/auth-node /shared/auth-node
WORKDIR /app
COPY 07-ms-configuration/package*.json ./
RUN npm ci --ignore-scripts
COPY 07-ms-configuration/ .
RUN npm run build

FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends wget curl && rm -rf /var/lib/apt/lists/*
COPY shared/auth-node /shared/auth-node
WORKDIR /app
COPY 07-ms-configuration/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 8087
CMD ["node","dist/main.js"]
