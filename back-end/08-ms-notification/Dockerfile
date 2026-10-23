# Build context: back-end/ (package.json links ../shared/auth-node, which lands at /shared).
FROM node:20-slim AS builder
COPY shared/auth-node /shared/auth-node
WORKDIR /app
COPY 08-ms-notification/package*.json ./
RUN npm ci
COPY 08-ms-notification/ .
RUN npm run build

FROM node:20-slim
RUN apt-get update && apt-get install -y wget curl && rm -rf /var/lib/apt/lists/*
COPY shared/auth-node /shared/auth-node
WORKDIR /app
COPY 08-ms-notification/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
RUN chown -R node:node /app
USER node
EXPOSE 8088
CMD ["node","dist/main.js"]
