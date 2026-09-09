# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────
# base — shared OS layer. openssl is required by the Prisma
# query engine on Alpine; dumb-init gives us correct PID-1
# signal handling so SIGTERM actually stops Nest gracefully.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl dumb-init
ENV NODE_ENV=production


# ─────────────────────────────────────────────────────────────
# build — full dependency tree, generate the Prisma client,
# compile TypeScript. Nothing from this stage ships.
# ─────────────────────────────────────────────────────────────
FROM base AS build
ENV NODE_ENV=development

# Dependencies are cached on the manifests alone, so a source-only
# change never re-runs npm ci. --ignore-scripts stops the
# postinstall `prisma generate` firing before the schema is copied.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

COPY . .

# `prebuild` runs `prisma generate`, then nest compiles to dist/
RUN npm run build


# ─────────────────────────────────────────────────────────────
# prod-deps — production dependencies only, with the Prisma
# client generated against them. Built in parallel with `build`.
# ─────────────────────────────────────────────────────────────
FROM base AS prod-deps

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

# Generated locally from the installed CLI — no network, no npx download.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate


# ─────────────────────────────────────────────────────────────
# runtime — final image. No source, no toolchain, no dev deps.
# ─────────────────────────────────────────────────────────────
FROM base AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    RUN_MIGRATIONS=true

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/prisma ./prisma
COPY --from=build     --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./

# node:alpine ships an unprivileged `node` user (uid 1000) — use it
# rather than minting another one.
USER node

EXPOSE 3000

# Hits the public GET / route. busybox wget is already in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 || exit 1

ENTRYPOINT ["dumb-init", "--"]

# `migrate deploy` takes a Postgres advisory lock, so it is safe when
# several replicas start at once. Set RUN_MIGRATIONS=false to skip it
# and run migrations from a separate deploy step instead.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" != \"false\" ]; then npx prisma migrate deploy; fi; exec node dist/main.js"]
