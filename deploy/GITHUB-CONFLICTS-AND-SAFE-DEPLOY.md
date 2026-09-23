# KDF‑MSC Portal — GitHub Conflict Reconciliation & Safe Production Deployment

> Audience: Project owner + MoD IT team
> Scope: How to safely merge the new **V2** version into `main` on GitHub, then roll it out to the live MoD VPS without breaking the current site.
> Assumptions used in this guide (adjust to match reality):
> - There is (or soon will be) a live version of the app on the VPS.
> - Emergent has the newest V2 changes; GitHub `main` may have drift from prior commits.
> - The MoD IT team runs the VPS deploy commands.
> - Container images are published to **GHCR** via the existing `.github/workflows/ghcr-release.yml`.

---

## PART A — Reconciling Conflicts on GitHub

### A0. Golden rules (read first)

1. **Never resolve conflicts directly on `main`.** Always work in a release branch and open a Pull Request.
2. **Never force‑push `main`.** History rewrites break every teammate’s clone and every deployed tag.
3. Use Emergent’s **“Save to GitHub”** button — do NOT ask the Emergent agent to run `git push` for you.
4. Take a **DB snapshot** before every deploy, even if the code change looks harmless.
5. Tag every production release (e.g. `v2.0.0`) so you can roll back to an exact image.

### A1. Understand what has diverged

On GitHub, open the repo → **branches** page → the yellow *"This branch is X commits ahead / Y commits behind main"* banner tells you the direction of drift.

| Situation | What it means | Action |
|---|---|---|
| Emergent ahead, GitHub unchanged | Clean fast‑forward | Just click **Save to GitHub** → merge PR |
| GitHub ahead (someone pushed hot‑fixes) | True 3‑way merge required | Follow A2 below |
| Both sides ahead | Real conflicts likely | Follow A2 below |

### A2. The safe reconciliation workflow

1. **In Emergent**, click **Save to GitHub**. It will create/update a branch (typically `emergent-<id>` or the one you configured). Do NOT merge it yet.
2. **In GitHub UI**, open a Pull Request from that branch → base `main`.
3. If GitHub says **“This branch has conflicts that must be resolved”**, click **Resolve conflicts**. The web editor opens each conflicted file with `<<<<<<<` / `=======` / `>>>>>>>` markers.
4. Resolve **file‑by‑file** using the cheatsheet in A3.
5. Click **Mark as resolved** → **Commit merge**.
6. Wait for the **GHCR Release** GitHub Action to go green (it builds & pushes the image).
7. Only then merge the PR into `main` with **“Create a merge commit”** (NOT squash, so the merge history is preserved).
8. **Tag the release** on `main`:
   `Releases → Draft a new release → Tag: v2.0.0 → Publish`. This triggers a tagged image push (`ghcr.io/<org>/<repo>:v2.0.0`) which is what production will pull.

### A3. File‑by‑file conflict cheatsheet

These are the files most likely to conflict in this repo and the safe way to resolve each:

| File | Common conflict | Safe resolution |
|---|---|---|
| `app/page.js` (~8300 lines) | Two feature branches edited the same SPA sections | Prefer **Emergent (V2) version**. It is the source of truth for UI. If GitHub has a real bug‑fix, cherry‑pick just that hunk in. |
| `app/api/[[...path]]/route.js` (~3700 lines) | New endpoints added on both sides | **Keep both** endpoints — they’re additive. If the SAME endpoint diverges, prefer Emergent’s V2 (rank capture, BCC secretary, gating). |
| `prisma/schema.prisma` | Both sides added models or fields | **Keep both models/fields**. Then, right after merge, run `npx prisma migrate dev --name reconcile-v2` locally so the migration file lands in the PR before merging. |
| `prisma/migrations/*` | Different migration timestamps | Never delete an already‑applied migration. Instead, add a NEW migration that reconciles the schema. |
| `package.json` / `yarn.lock` | Different dependency versions | Keep the **higher** version, then run `yarn install` to regenerate `yarn.lock`. Commit both. |
| `.github/workflows/ghcr-release.yml` | Workflow tweaks on both sides | Prefer Emergent’s version (it already builds & tags correctly). |
| `.env.production.template` | New keys added | Union of both. Never delete a key someone else added. |
| `deploy/Caddyfile` | Domain/routing tweaks | Prefer the version that matches the **actual live domain**. |
| `public/abstract-guidelines.txt` | Date/theme edits | Prefer the most recent dates. |

### A4. If you get stuck — the “nuclear but safe” option

If the web merge is unmanageable:

```bash
# on your laptop, NOT the VPS
git clone https://github.com/<org>/<repo>.git
cd <repo>
git checkout -b v2-release origin/emergent-<id>
git fetch origin
git merge origin/main            # resolve conflicts in your editor
git push origin v2-release
```

Then open a fresh PR from `v2-release → main`. This gives you a proper diff tool (VS Code’s 3‑way merge) instead of the GitHub web editor.

### A5. Rollback path (before you deploy)

If the merged `main` turns out to be wrong, **do not force‑push**. Instead:

```bash
git revert -m 1 <merge-commit-sha>
git push origin main
```

That creates a new commit that undoes the merge, triggers a new image build, and preserves history.

---

## PART B — Safe Deployment to the MoD VPS

### B1. Pre‑flight checklist (do these BEFORE touching the VPS)

- [ ] PR merged into `main` and CI is **green**.
- [ ] Release tag created (`v2.0.0`) and the tagged image is visible in **GHCR → Packages**.
- [ ] `.env.production` on the VPS has every key from `.env.production.template` (see `deploy/SECRETS-CHECKLIST.md`). Missing keys are the #1 cause of prod outages here (Neon URL, JWT_SECRET, RESEND_API_KEY, LiveKit keys, SECRETARY_EMAIL, NEXT_PUBLIC_BASE_URL).
- [ ] Neon PostgreSQL **branch/snapshot** taken (Neon → Branches → “Create branch from current”). Name it `pre-v2-<yyyy-mm-dd>`.
- [ ] Note down the **currently running image tag** on the VPS (`docker ps --format '{{.Image}}'`). You will need it for rollback.
- [ ] Announce a **maintenance window** to conference stakeholders (even 5 minutes).

### B2. Deploy — zero‑downtime‑ish rollout

Run these commands on the VPS as the deploy user:

```bash
cd /opt/kdf-msc                                   # or wherever docker-compose.yml lives

# 1. Log in to GHCR (only needed once per host, uses a PAT with read:packages)
echo "$GHCR_PAT" | docker login ghcr.io -u <github-user> --password-stdin

# 2. Pin the new tag in docker-compose.yml (or .env used by compose)
#    Example line to change:
#    image: ghcr.io/<org>/<repo>:v2.0.0
sed -i 's|ghcr.io/<org>/<repo>:.*|ghcr.io/<org>/<repo>:v2.0.0|' docker-compose.yml

# 3. Pull the new image
docker compose pull app

# 4. Run DB migrations FIRST, against the new image, before swapping traffic
docker compose run --rm app npx prisma migrate deploy

# 5. Bring up the new container (Caddy in front keeps the old one warm until this is healthy)
docker compose up -d app

# 6. Verify health
docker compose ps
docker compose logs --tail=200 app
curl -fsS https://<your-domain>/api/health || echo "HEALTH FAILED"
```

> If you use `docker compose` with a single `app` service, there is a ~2‑second gap during restart. That is acceptable for a conference portal. For true zero downtime, run two replicas behind Caddy and restart them one at a time.

### B3. Post‑deploy smoke tests (do all five)

1. **Login** as `mayshno@gmail.com` — dashboard loads, role = SYSTEM_ADMIN.
2. **Register** a new dummy delegate with rank “Capt” → confirmation email arrives via Resend.
3. **Submit an abstract** → secretary (`secretary-kdfmsc@mod.go.ke`) receives the BCC.
4. **Download name tag PDF** → rank abbreviation appears before the name.
5. **Download accepted abstract as .docx** → opens cleanly in Word.

If any of the five fail, go to B5 (Rollback) immediately — do not try to hot‑patch prod.

### B4. Prisma / data safety notes

- `prisma migrate deploy` is **idempotent and non‑destructive** for additive migrations. It will NOT drop columns unless a migration explicitly does so.
- Never run `prisma migrate reset` on production. It wipes the database.
- If a migration fails halfway, the transaction rolls back. You can safely re‑run it after fixing the underlying issue.
- The V2 data purge was already run once. It is **not** part of any migration file, so a redeploy will NOT re‑purge users. Good.

### B5. Rollback procedure (if smoke tests fail)

```bash
# 1. Re-pin the previous image tag (the one you noted in B1)
sed -i 's|ghcr.io/<org>/<repo>:.*|ghcr.io/<org>/<repo>:<previous-tag>|' docker-compose.yml
docker compose pull app
docker compose up -d app

# 2. If (and ONLY if) migrations broke data, restore the DB
#    In Neon dashboard: Branches → pre-v2-<date> → "Restore" → confirm
#    App picks up automatically if DATABASE_URL points at the primary branch.
```

Then open an incident ticket, capture logs (`docker compose logs app > incident-<date>.log`), and iterate in a preview environment — never on prod.

### B6. Ongoing hygiene

- Keep the last **3 image tags** on the VPS so rollback is instant: `docker image ls | grep <repo>`.
- Prune older images monthly: `docker image prune -a --filter "until=720h"`.
- Rotate `JWT_SECRET` and `RESEND_API_KEY` at least once per conference cycle. Rotating `JWT_SECRET` will log everyone out — do it during the maintenance window.
- Back up `.env.production` to an encrypted vault (1Password / MoD KMS). If the VPS disk dies, this file is what you need to restore fastest.

---

## Quick reference — the 8‑step release ritual

1. Emergent → **Save to GitHub** (branch).
2. GitHub → open PR → resolve conflicts using A3 cheatsheet.
3. Merge PR into `main` (merge commit, not squash).
4. Create a **Release tag** (`v2.x.y`) → CI builds the image.
5. VPS → snapshot Neon DB.
6. VPS → pin new tag → `docker compose pull` → `prisma migrate deploy` → `docker compose up -d`.
7. Run the 5 smoke tests in B3.
8. Green? Announce done. Red? Execute B5 rollback.

---

*Last updated: with the V2 release (military ranks, live gating, secretary BCC, DOCX export, Programme UI overhaul). The 11‑page Conference Book PDF generator is a separate follow‑up release and is NOT part of V2.*
