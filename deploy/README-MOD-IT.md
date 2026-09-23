# SCMS Deployment Runbook — MoD IT

**System**: Scientific Conference Management System (SCMS)
**Domain**: https://medals-scms.mod.go.ke
**Owner (dev)**: <YOUR NAME + EMAIL + PHONE>
**Handoff date**: <FILL DATE>
**Image version**: <FILL, e.g. v1.0.0>

---

## 1. What this system is

A web platform for the MoD scientific conference — handles registration, abstract
submission, editorial review, programme scheduling, live video presentations, and
certificate generation. Serves ~500 concurrent users at peak (during a live
conference), <50 concurrent the rest of the year.

**Tech stack** (all managed for you — you only host the container):
- Runtime: Docker container (Node.js 20 / Next.js 15)
- Database: **Neon Postgres** (managed cloud, no local DB to run)
- Email: **Resend** (managed cloud)
- Video: **LiveKit Cloud** (managed cloud)
- Storage: local volume on the VPS (`scms_uploads`)

---

## 2. VPS specification

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 100 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| Network | Public IPv4, ports 22/80/443 reachable | + IPv6 |

---

## 3. Firewall (ufw or your cloud SG)

```bash
sudo ufw allow 22/tcp     # SSH (restrict to MoD IT jump host if possible)
sudo ufw allow 80/tcp     # HTTP (Let's Encrypt HTTP-01 challenge only)
sudo ufw allow 443/tcp    # HTTPS (public)
sudo ufw --force enable
```
Do NOT expose port 3000 publicly — the reverse proxy handles TLS on 443.

---

## 4. DNS records (please create at your domain manager for `mod.go.ke`)

| Type | Host                        | Value            | TTL |
|------|-----------------------------|------------------|-----|
| A    | medals-scms.mod.go.ke       | <VPS IPv4>       | 300 |
| AAAA | medals-scms.mod.go.ke       | <VPS IPv6>       | 300 |
| CAA  | medals-scms.mod.go.ke       | 0 issue "letsencrypt.org" | 300 |

Optional (only if you want gov email for this system):

| Type | Host                              | Value                     |
|------|-----------------------------------|---------------------------|
| MX   | medals-scms.mod.go.ke             | 10 mail.mod.go.ke         |
| TXT  | medals-scms.mod.go.ke             | v=spf1 include:mod.go.ke ~all |

---

## 5. First-boot procedure

### 5a. Install Docker + Docker Compose
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
docker --version && docker compose version
```

### 5b. Log in to GHCR (image is at `ghcr.io/<DEV_GH_USER>/scms`)
**Credentials will be provided separately by the dev owner (via encrypted channel).**
```bash
echo "<PAT>" | docker login ghcr.io -u <DEV_GH_USER> --password-stdin
```

### 5c. Drop the handoff files
```bash
sudo mkdir -p /opt/scms
sudo cp docker-compose.yml /opt/scms/
sudo cp .env.production.template /opt/scms/.env
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # after installing Caddy — step 5e
sudo chown -R $USER:$USER /opt/scms
cd /opt/scms
nano .env    # fill in the secrets — see SECRETS-CHECKLIST.md
```

### 5d. Pull + boot the app
```bash
cd /opt/scms
docker compose pull app
docker compose up -d --no-deps app     # --no-deps skips the local Postgres (using Neon)
docker compose logs -f app             # watch for "Ready in X ms"
```

### 5e. Install reverse proxy (Caddy — handles TLS automatically)
```bash
sudo apt-get install -y caddy
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```
Caddy fetches a Let's Encrypt cert on first request. Watch `/var/log/caddy/*.log`
to confirm.

### 5f. Smoke test
```bash
curl -I https://medals-scms.mod.go.ke/api/public/config    # → 200
curl -s https://medals-scms.mod.go.ke | head -20            # HTML with 'SCMS' in it
```

Open the URL in a browser and log in with the admin account credentials (provided
separately by dev owner).

---

## 6. Day-2 operations

| Task                       | Command                                              |
|----------------------------|------------------------------------------------------|
| Start / stop the app       | `docker compose up -d` / `docker compose down`      |
| Tail live logs             | `docker compose logs -f app`                         |
| Restart after config edit  | `docker compose restart app`                         |
| Upgrade to new version     | `docker compose pull app && docker compose up -d`   |
| Rollback                   | Edit `image:` tag in compose to previous version, `up -d` |
| Shell into container       | `docker compose exec app sh`                         |
| Disk usage                 | `docker system df -v`                                |
| Clean up old images        | `docker image prune -a --filter until=168h`          |

---

## 7. Backups

### Uploads (local volume — user-submitted files)
Cron entry (`crontab -e`):
```cron
0 3 * * * /usr/bin/docker run --rm -v scms_uploads:/data -v /var/backups/scms:/out alpine \
  tar czf /out/uploads-$(date +\%F).tgz -C /data . \
  && find /var/backups/scms -name 'uploads-*.tgz' -mtime +30 -delete
```

### Database (Neon — cloud managed)
Neon has automatic PITR (point-in-time recovery). To take a manual snapshot:
```bash
# Ask dev owner for Neon console access, or:
pg_dump "$DATABASE_URL" | gzip > /var/backups/scms/db-$(date +%F).sql.gz
```
(Install postgresql-client first: `sudo apt-get install postgresql-client`.)

### Offsite copy
Sync `/var/backups/scms/` to a MoD-managed backup server nightly (rsync/rclone).

---

## 8. Monitoring

Minimum:
```bash
# Container health
docker compose ps                  # STATUS should be 'healthy'

# Simple uptime cron
* * * * * curl -sf https://medals-scms.mod.go.ke/api/public/config >/dev/null \
  || echo "SCMS DOWN at $(date)" | mail -s "[SCMS ALERT]" mod-it-oncall@mod.go.ke
```
Recommended add-ons: Uptime Kuma, Prometheus + node-exporter, or Netdata.

---

## 9. Security notes

- ⚠ `.env` at `/opt/scms/.env` contains all secrets. `chmod 600` it, owned by root.
- ⚠ Never commit the production `.env` to any repo.
- ⚠ Rotate `JWT_SECRET`, `DATABASE_URL` password, `RESEND_API_KEY`, and
  `LIVEKIT_API_KEY`/`SECRET` every 90 days (see SECRETS-CHECKLIST.md).
- ⚠ The GHCR PAT expires — rotate quarterly.
- SSH should be key-based only; disable password auth in `/etc/ssh/sshd_config`.
- Enable `unattended-upgrades` for OS security patches.
- Log the reverse proxy access log to a SIEM if MoD has one.

---

## 10. Escalation

| Layer                     | Contact                     | SLA         |
|---------------------------|-----------------------------|-------------|
| App / feature bugs        | <DEV_NAME> <DEV_EMAIL>      | Business hrs |
| Neon Postgres outage      | https://neonstatus.com      | Managed     |
| Resend email outage       | https://resend.status.page  | Managed     |
| LiveKit outage            | https://status.livekit.io   | Managed     |
| VPS / OS / network        | MoD IT internal on-call     | Per MoD SLA |

---

_Last updated: <FILL DATE>_
