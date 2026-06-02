# Dockerfile — nu PMC v4
# Multi-stage build: separate deps layer from source so code changes don't
# bust the npm install cache.

# ─── Stage 1: install production deps ────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Some native modules (bcryptjs is pure JS, sharp has prebuilt binaries,
# but we keep the toolchain in case a dep needs to build from source).
RUN apk add --no-cache python3 make g++ vips-dev

COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# ─── Stage 2: runtime image ──────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Runtime libs only (no build toolchain). sharp needs libvips at runtime.
# mariadb-client needed so seed-full.sh can run mysql commands inside the container.
RUN apk add --no-cache vips tini mariadb-client bash curl

# Create non-root user for the app — never run node as root in prod.
RUN addgroup -S nuapp && adduser -S nuapp -G nuapp

# Copy deps layer
COPY --from=deps /app/node_modules ./node_modules

# Copy source. .dockerignore excludes node_modules, .git, uploads/*, logs.
COPY --chown=nuapp:nuapp . .

# Writable dirs for uploads + user data (mount these as volumes in compose)
RUN mkdir -p /app/uploads /app/user-data && chown -R nuapp:nuapp /app/uploads /app/user-data

USER nuapp

# tini as PID 1 so node gets proper signal handling (Ctrl-C, docker stop).
ENTRYPOINT ["/sbin/tini", "--"]

EXPOSE 3100

# Simple health check — nu PMC has no dedicated /health endpoint, so probe
# the login page. A 200 response means node + session + DB are all alive.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f --max-time 3 http://localhost:3100/ || exit 1

CMD ["node", "server.js"]
