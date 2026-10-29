# Build context: back-end/ (package.json links ../shared/auth-node, which lands at /shared).
FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0 AS builder
COPY shared/auth-node /shared/auth-node
WORKDIR /app
COPY 09-ms-quality/package*.json ./
RUN npm ci --ignore-scripts
COPY 09-ms-quality/ .
RUN npm run build

FROM node:20-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0
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
