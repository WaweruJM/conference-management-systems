# ────────────────────────────────────────────────────────────────────────────
# SCMS — Scientific Conference Management System
# Multi-stage production Dockerfile
#
# Uses Next.js "standalone" output (configured in next.config.js) for a lean
# runtime image (~140 MB) that does not need node_modules at runtime.
# ────────────────────────────────────────────────────────────────────────────

# ═══════════════════════════════════════════════════════════════════════════
# Stage 1: dependencies — install ALL deps (dev + prod) with the same lockfile
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS deps
WORKDIR /app

# Alpine needs libc6-compat for some Node native modules (bcrypt, sharp, pdfkit)
RUN apk add --no-cache libc6-compat openssl

# Copy only the manifest first so this layer is cache-friendly.
# The trailing '*' on yarn.lock makes it OPTIONAL — if the lockfile isn't
# committed to the repo yet, the build still succeeds (falls back to a
# non-frozen install below). For reproducible production builds, commit
# yarn.lock so `--frozen-lockfile` is used.
COPY package.json ./
COPY yarn.lock* ./
COPY prisma ./prisma

RUN if [ -f yarn.lock ]; then \
      echo "→ yarn.lock found — running frozen install"; \
      yarn install --frozen-lockfile --network-timeout 300000; \
    else \
      echo "→ yarn.lock MISSING — running non-frozen install (not reproducible!)"; \
      yarn install --network-timeout 300000; \
    fi

# ═══════════════════════════════════════════════════════════════════════════
# Stage 2: builder — build Next.js standalone bundle + generate Prisma client
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env — supply anything needed at compile time (e.g. NEXT_PUBLIC_*).
# Do NOT pass real secrets here; the placeholders below only exist so that
# module-level guards (which throw on missing env) don't abort `next build`
# during page-data collection. Real values are injected at runtime by compose.
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}
ENV NEXT_TELEMETRY_DISABLED=1

# ── Build-only placeholders (NOT baked into the runner image) ──────────────
# Some server modules validate env vars at import time (e.g. JWT_SECRET must
# be >=32 chars). Next.js touches these modules while collecting page data,
# so we supply harmless placeholders here. The runner stage overrides them
# with real values from the environment / docker-compose.
ENV JWT_SECRET="build_time_placeholder_do_not_use_in_prod_change_me_now"
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

# Generate Prisma client, then compile Next.js. The postinstall/build scripts
# in package.json already invoke `prisma generate && next build`.
RUN yarn build

# Fail the stage explicitly if Next.js didn't produce the standalone output.
# (Safeguard against the previous package.json build script that swallowed
# non-zero exit codes via trailing `|| true` chains.)
RUN test -d .next/standalone \
      || (echo "❌ .next/standalone missing — next build failed silently" && exit 1)

# ═══════════════════════════════════════════════════════════════════════════
# Stage 3: runner — minimal runtime image
# ═══════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl tini curl

# Run as a dedicated non-root user for defence-in-depth
RUN addgroup --system --gid 1001 nodejs \
  && adduser  --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOAD_DIR=/app/uploads

# Copy Prisma schema + generated client (needed at runtime for `db push` + queries)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

# Copy the standalone Next.js output. The standalone folder contains a minimal
# node_modules with only what the built app needs.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Uploads directory (mounted as a volume in compose so files persist)
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# Entrypoint script — runs Prisma schema sync then starts the server
COPY --chown=nextjs:nodejs docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nextjs

EXPOSE 3000

# Container healthcheck — pings the frontend home page. If it returns non-2xx
# for 30 s the orchestrator will restart the container.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/public/config || exit 1

# `tini` reaps zombie processes properly (Node.js does not by default)
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
