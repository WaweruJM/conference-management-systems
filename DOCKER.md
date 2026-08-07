# SCMS — Docker Quick Start

The application ships with a production-grade multi-stage `Dockerfile` and a
`docker-compose.yml` that boots the full stack (Next.js + Postgres 16) with a
single command.

> ⚠️ **The Emergent cloud sandbox does not have a Docker daemon.**
> The commands below must be executed on your **local machine** (or any VM
> where `docker` and `docker compose` are installed).

---

## 1. Prerequisites

- Docker Engine ≥ 24
- Docker Compose plugin ≥ 2.20 (bundled with recent Docker Desktop)
- ~2 GB free disk for the image + Postgres volume

Check with:

```bash
docker --version
docker compose version
```

---

## 2. Configure environment

```bash
cp .env.docker.example .env
# then edit .env and fill in JWT_SECRET, RESEND_*, LIVEKIT_*, etc.
```

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

---

## 3. Build & run (local Postgres included)

```bash
# from the repo root (where docker-compose.yml lives)
docker compose build            # ~4–6 min the first time
docker compose up -d            # starts db + app in the background
docker compose logs -f app      # tail the Next.js logs
```

Open http://localhost:3000 — the schema is auto-pushed on first boot by the
entrypoint script.

Seed the admin account by registering `mayshno@gmail.com` (or any email you
choose) via the sign-up page, then promote it manually in psql:

```bash
docker compose exec db psql -U scms -d scms \
  -c "UPDATE \"User\" SET roles = ARRAY['SYSTEM_ADMIN'] WHERE email='you@example.com';"
```

---

## 4. Run against Neon (managed Postgres)

Edit `.env` and set:

```env
DATABASE_URL=postgresql://<user>:<pw>@<neon-host>/<db>?sslmode=require
```

Then disable the bundled db service:

```bash
docker compose up -d --no-deps app
```

(or comment out the `db:` block in `docker-compose.yml`).

---

## 5. Common commands

| Task                       | Command                                              |
|----------------------------|------------------------------------------------------|
| Stop stack                 | `docker compose down`                                |
| Stop + wipe DB volume      | `docker compose down -v`                             |
| Rebuild after code change  | `docker compose build app && docker compose up -d`   |
| Shell into app             | `docker compose exec app sh`                         |
| Prisma studio (local db)   | `docker compose exec app npx prisma studio`          |
| Tail logs                  | `docker compose logs -f app`                         |
| Backup uploads             | `docker run --rm -v scms_uploads:/data -v $PWD:/backup alpine tar czf /backup/uploads.tgz -C /data .` |

---

## 6. Production notes

- **HTTPS**: put nginx / Caddy / a cloud LB in front of the container.
  Then set `NEXT_PUBLIC_BASE_URL=https://your-domain` and rebuild.
- **Uploads**: the named volume `scms_uploads` persists across restarts.
  For multi-node deployments, replace it with S3 / GCS (code hook lives in
  `/app/lib/uploads.js`).
- **Health**: the container exposes `GET /api/public/config` as a healthcheck.
  Wire it into your orchestrator (K8s liveness/readiness, ECS, Fly, …).
- **Scaling**: the app is stateless (sessions are JWT). Scale horizontally by
  running multiple `app` replicas behind a load balancer; keep Postgres
  managed / HA.
