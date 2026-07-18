#!/bin/bash
# SCMS bootstrap: ensures postgres is installed, running, and DB exists
set -e

if ! id postgres >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  echo "[scms-bootstrap] Installing postgresql..."
  apt-get update -qq
  apt-get install -y postgresql postgresql-contrib >/dev/null 2>&1
fi

# Ensure cluster running
if ! pg_lsclusters 2>/dev/null | grep -q "online"; then
  pg_ctlcluster 15 main start 2>/dev/null || true
fi

# Ensure DB + user exist
su - postgres -c "psql -tc \"SELECT 1 FROM pg_user WHERE usename='scms'\"" 2>/dev/null | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE USER scms WITH PASSWORD 'scms_dev_pw';\""

su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='scms_db'\"" 2>/dev/null | grep -q 1 || {
  su - postgres -c "psql -c \"CREATE DATABASE scms_db OWNER scms;\""
  su - postgres -c "psql -d scms_db -c \"GRANT ALL ON SCHEMA public TO scms;\""
}

# Apply schema & seed if empty
cd /app
npx prisma db push --skip-generate 2>&1 | tail -2

USER_COUNT=$(su - postgres -c "psql -tAd scms_db -c 'SELECT COUNT(*) FROM \"User\";'" 2>/dev/null || echo 0)
if [ "$USER_COUNT" -lt 1 ]; then
  node prisma/seed.js
fi

echo "[scms-bootstrap] Ready."
