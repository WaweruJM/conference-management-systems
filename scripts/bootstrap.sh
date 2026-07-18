#!/bin/bash
# SCMS bootstrap: uses external DATABASE_URL (Neon PostgreSQL).
# Runs prisma migrations idempotently; no local postgres needed.
set -e
cd /app

echo "[scms-bootstrap] Ensuring Prisma schema is in sync with Neon DB..."
npx prisma db push --skip-generate --accept-data-loss 2>&1 | tail -3 || true

# Check if seed data exists; if not, seed
if [ -f /app/prisma/seed.js ]; then
  node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>{console.log('user count:',c);process.exit(c>0?0:2)})" 2>/dev/null
  if [ $? -eq 2 ]; then
    echo "[scms-bootstrap] Empty DB; seeding..."
    node /app/prisma/seed.js || echo "[scms-bootstrap] seed failed (non-fatal)"
  else
    echo "[scms-bootstrap] DB already seeded."
  fi
fi

echo "[scms-bootstrap] Ready."
