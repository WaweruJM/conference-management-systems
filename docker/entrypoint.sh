#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# SCMS container entrypoint
# ─────────────────────────────────────────────────────────────────────────────
# Runs at container start (both `docker run` and `docker compose up`).
#
# Responsibilities:
#   1. Verify required env vars are present (fail fast with a clear message).
#   2. Push the Prisma schema to the target Postgres database.
#      * Uses `prisma db push` (idempotent, no migration history).
#      * Safe to run on every boot – it only alters the DB when the schema
#        actually diverges.
#   3. Exec the Next.js standalone server as PID 1 (tini reaps zombies).
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "────────────────────────────────────────────────────────────"
echo " SCMS — starting container ($(date -u +%FT%TZ))"
echo "────────────────────────────────────────────────────────────"

# --- 1. env sanity check -----------------------------------------------------
missing=""
for v in DATABASE_URL JWT_SECRET; do
  eval val=\"\$$v\"
  if [ -z "$val" ]; then
    missing="$missing $v"
  fi
done
if [ -n "$missing" ]; then
  echo "[entrypoint] FATAL — missing required env vars:$missing" >&2
  echo "[entrypoint] Provide them via docker-compose env_file / -e flags." >&2
  exit 1
fi

# --- 2. optional wait-for-db (best-effort, non-fatal) ------------------------
# When the compose file spins up a local Postgres, this loop gives it a few
# seconds to become reachable before the schema push. External DBs (e.g. Neon)
# skip this quickly.
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/?]*\).*|\1|p')
if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ]; then
  echo "[entrypoint] Waiting for Postgres at $DB_HOST (max 30s)..."
  i=0
  while [ $i -lt 30 ]; do
    if nc -z "$DB_HOST" 5432 2>/dev/null; then
      echo "[entrypoint] Postgres reachable."
      break
    fi
    i=$((i+1))
    sleep 1
  done
fi

# --- 3. prisma schema sync ---------------------------------------------------
# Invoke the prisma CLI directly (node_modules/.bin is not shipped in the
# standalone runner image; we copy node_modules/prisma from the builder).
PRISMA_BIN="./node_modules/prisma/build/index.js"
if [ -f "$PRISMA_BIN" ]; then
  echo "[entrypoint] Syncing Prisma schema (db push)..."
  if ! node "$PRISMA_BIN" db push --skip-generate --accept-data-loss=false 2>&1; then
    echo "[entrypoint] WARNING: prisma db push failed — server will still start." >&2
    echo "[entrypoint] Run 'node $PRISMA_BIN db push' manually if the DB is out of sync." >&2
  fi
else
  echo "[entrypoint] Prisma CLI not found at $PRISMA_BIN — skipping schema sync." >&2
fi

# --- 4. ensure uploads dir exists (bind-mount friendly) ----------------------
mkdir -p "${UPLOAD_DIR:-/app/uploads}"

# --- 5. launch Next.js standalone server -------------------------------------
echo "[entrypoint] Starting Next.js on 0.0.0.0:${PORT:-3000}"
exec node server.js
