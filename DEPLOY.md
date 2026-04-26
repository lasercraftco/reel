# Reel — deploy guide

## What's in the box

```
reel/
├── reel-web/        Next.js 15 + Tailwind v4 + shadcn/ui (multi-user, magic-link auth)
├── reel-engine/     FastAPI 0.115 + SQLAlchemy 2 + 11-scorer ensemble
├── deploy/          docker-compose + bootstrap.sh + cloudflared notes
├── .github/         CI: lint + multi-arch image build → ghcr.io
└── .env.example     all env vars
```

## One-shot first-time install (run on iMac, 192.168.1.92)

```bash
ssh imac
gh repo create lasercraftco/reel --private --source ~/Documents/reel --remote origin --push
git clone https://github.com/lasercraftco/reel ~/homelab/reel
cd ~/homelab/reel
bash deploy/bootstrap.sh
```

The script:

1. Verifies Docker is running and `~/homelab/.env` exists
2. Stitches `TMDB_API_KEY`, `RADARR_KEY`, `PLEX_TOKEN`, `ANTHROPIC_API_KEY`,
   `SMTP_*`, `TYFLIX_AUTH_JWT_SECRET` (auto-generates if missing) into a fresh
   `~/homelab/reel/.env` (chmod 600)
3. Pulls `ghcr.io/lasercraftco/reel-engine:latest` and `reel-web:latest`
4. Boots Postgres → engine → web via `deploy/docker-compose.yml`
5. Web container runs Drizzle migrations on first boot (`migrations applied`)
6. Triggers an initial `POST /api/library/scan` (Radarr + Plex)
7. Adds the `reel.tyflix.net` ingress rule on `infra` over SSH and restarts
   `cloudflared`
8. Creates the CNAME via the Cloudflare API (if `CF_API_TOKEN` is set)

When it finishes you have **https://reel.tyflix.net**.

## Watchtower auto-deploy

Both images are labeled `com.centurylinklabs.watchtower.enable=true`. Push to
`main` → GH Actions builds + pushes multi-arch to `ghcr.io/lasercraftco/*` →
Watchtower (already running on the iMac) pulls + restarts within ~5 min.

## Multi-user auth + SSO

`TYFLIX_AUTH_JWT_SECRET` is shared with Genome + Karaoke. Cookie domain is
`.tyflix.net`. See [`deploy/auth-architecture.md`](deploy/auth-architecture.md)
for the wiring.

Roles:

- **owner** — Tyler. Full admin, direct Radarr writes.
- **trusted** — close friends. Direct add (auto-approved).
- **friend** (default) — request adds; owner approves at `/admin/requests`.
- **guest** — read-only.

`TYFLIX_OWNER_EMAIL=tylerheon@gmail.com` is auto-promoted to `owner` on first
sign-in.

## Local dev

```bash
cp .env.example .env
make dev          # postgres + engine + web (compose dev override)
open http://localhost:3033
```

Standalone:

```bash
make dev-web      # Next.js dev server on :3033
make dev-engine   # FastAPI uvicorn on :8002
```

## Operational commands

```bash
make scan         # one-shot Radarr+Plex pull
make logs         # tail compose logs
make ps           # show containers
make down         # stop the stack
docker exec reel-engine python -m app.cli  # (room for future CLI)
```

## Verification done in this session

- `pytest -q tests/test_smoke.py` → 4/4 pass (scorers register, math sane)
- `pytest -q tests/test_auth.py` → 1/1 pass (JWT round-trip with shared secret)
- `python -c "from app.main import app"` → 45 routes register cleanly
- Static check on web: 59 .ts/.tsx files, 0 explicit `: any` types

## What still needs Tyler's hands

1. `gh repo create lasercraftco/reel` and push
2. `bash deploy/bootstrap.sh` on iMac — idempotent
3. Approve a couple friend requests at `/admin/requests` once friends sign in
4. Optional: paste the same `TYFLIX_AUTH_JWT_SECRET` into Genome + Karaoke
   `~/homelab/.env` so SSO clicks across all three
