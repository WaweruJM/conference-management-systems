# SCMS Environment Secrets Checklist

Use this file when filling in `/opt/scms/.env` on the VPS.

All `<PLACEHOLDER>` values will be delivered to MoD IT **separately** by the dev
owner over an encrypted channel (signed PGP email, or via MoD's approved secrets
vault). Never paste secrets into chat / ticketing / email plaintext.

---

## Required — the app will NOT start without these

| Var | Purpose | Source | Rotation |
|---|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string | Neon Console → Project → Connection string | 90 days |
| `JWT_SECRET` | Signs user session tokens (≥32 chars) | `openssl rand -hex 32` | 90 days |
| `NEXT_PUBLIC_BASE_URL` | Public URL of the app (must match domain) | Set to `https://medals-scms.mod.go.ke` | On domain change |
| `CORS_ORIGINS` | Allowed browser origins | Set to `https://medals-scms.mod.go.ke` | On domain change |

## Required for email notifications

| Var | Purpose | Source | Rotation |
|---|---|---|---|
| `EMAIL_PROVIDER` | Provider selector (fixed value `resend`) | — | Never |
| `RESEND_API_KEY` | Resend API auth | Resend dashboard → API Keys | 90 days |
| `EMAIL_FROM` | Displayed sender (name + address) | e.g. `SCMS Editorial <editorial@medals-scms.com>` | On email domain change |
| `EMAIL_FROM_NAME` | Sender friendly name | e.g. `SCMS Editorial Office` | On rebrand |

## Required for live video conferencing

| Var | Purpose | Source | Rotation |
|---|---|---|---|
| `LIVEKIT_URL` | LiveKit server (server-side) | LiveKit Cloud → Project settings | On project change |
| `LIVEKIT_API_KEY` | LiveKit API key | LiveKit Cloud → Keys | 90 days |
| `LIVEKIT_API_SECRET` | LiveKit API secret (pairs with key) | LiveKit Cloud → Keys | 90 days |
| `NEXT_PUBLIC_LIVEKIT_URL` | Same value as `LIVEKIT_URL` (exposed to browser) | — | With LIVEKIT_URL |

## Optional / advanced

| Var | Purpose | Default |
|---|---|---|
| `UPLOAD_DIR` | Where uploads persist inside the container | `/app/uploads` |
| `NODE_ENV` | Runtime mode | `production` (do not change) |
| `PORT` | Container listen port | `3000` (do not change) |

---

## `.env` template (copy to `/opt/scms/.env` and fill in)

```env
# ── App URLs ────────────────────────────────────────
NEXT_PUBLIC_BASE_URL=https://medals-scms.mod.go.ke
CORS_ORIGINS=https://medals-scms.mod.go.ke

# ── Auth ───────────────────────────────────────────
JWT_SECRET=<GENERATE: openssl rand -hex 32>

# ── Database (Neon) ────────────────────────────────
DATABASE_URL=<PROVIDED BY DEV — full postgresql://... string>

# ── Email (Resend) ─────────────────────────────────
EMAIL_PROVIDER=resend
RESEND_API_KEY=<PROVIDED BY DEV — re_...>
EMAIL_FROM=SCMS Editorial <editorial@medals-scms.com>
EMAIL_FROM_NAME=SCMS Editorial Office

# ── LiveKit ────────────────────────────────────────
LIVEKIT_URL=<PROVIDED BY DEV — wss://...livekit.cloud>
LIVEKIT_API_KEY=<PROVIDED BY DEV>
LIVEKIT_API_SECRET=<PROVIDED BY DEV>
NEXT_PUBLIC_LIVEKIT_URL=<same as LIVEKIT_URL>

# ── Storage ────────────────────────────────────────
UPLOAD_DIR=/app/uploads

# ── Legacy (leave blank) ───────────────────────────
MONGO_URL=
DB_NAME=
```

---

## Verify no secret leaked to the image

After first boot, confirm secrets live only in the env file — not baked into
the image:

```bash
docker compose exec app printenv | grep -E "JWT_SECRET|DATABASE_URL|RESEND" | wc -l   # should be 3
docker image inspect <IMAGE> | grep -iE "JWT_SECRET|password|resend|livekit_api_secret" \
  && echo 'LEAK — REBUILD IMAGE' || echo 'clean'
```
