# Reel — self-hosted movie discovery

A Plex-meets-Letterboxd discovery tool that scans your Radarr library, learns
your taste, and surfaces films you don't own with one-click "Add to library"
straight into Radarr → qBittorrent → Plex.

Code name **Reel** (placeholder; rename via `NEXT_PUBLIC_REEL_NAME` env var).

## Stack

- **Web:** Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui
- **Engine:** FastAPI (Python 3.12) — recommendation ensemble + scrapers
- **Database:** Postgres 16 (Drizzle ORM source-of-truth, mirrored to SQLAlchemy)
- **Hosting:** runs on iMac (192.168.1.92) under Docker Compose
- **Ingress:** Cloudflare tunnel → `https://reel.tyflix.net`
- **Auth:** none (Tailscale perimeter)

## Sources

- **TMDB** — primary metadata, posters, similar, recommendations, watch providers
- **OMDb** — IMDb / RT / Metacritic ratings relay
- **Letterboxd** — similar-films panel + list memberships (gentle scraping)
- **Trakt** — collaborative filtering
- **Reddit** — r/MovieSuggestions / r/ifyoulikethismovie crowd patterns
- **Wikipedia** — long synopses for plot embeddings
- **Radarr** — owned library + queue
- **Plex** — watch history + ratings (if reachable)
- **Anthropic API** — top-K rerank + "why this movie?" explanations

## Recommendation engine — 11-strategy ensemble

1. Content-based (genre / decade / runtime / language / rating vector cosine)
2. Plot embedding (sentence-transformer on Wikipedia synopsis)
3. Collaborative (Trakt similar users)
4. Letterboxd similar-films
5. TMDB similar + recommendations (combined)
6. Crew graph (director / writer / DoP / composer / lead actor)
7. Critic + popularity ensemble (RT / MC / IMDb / Letterboxd avg)
8. Awards graph (Oscars / Cannes / Sundance shortlists)
9. Reddit "if you liked X try Y"
10. LLM deep-rerank on top-50 (Anthropic) + "why this movie?" copy
11. Item2Vec on watch-history sessions

Ensemble: weighted sum + diversity penalty + 5–10 % surprise quota.

## Quickstart (dev)

```bash
cp .env.example .env       # fill in secrets
make dev                   # boot postgres + engine + web
open http://localhost:3033
```

## Deploy (iMac)

```bash
ssh imac
git clone https://github.com/lasercraftco/reel ~/homelab/reel
cd ~/homelab/reel
bash deploy/bootstrap.sh
```

`bootstrap.sh` is idempotent — it stitches secrets out of `~/homelab/.env`,
ships compose, runs migrations, opens the Cloudflare tunnel route, and prints
`https://reel.tyflix.net` when done.

## Layout

```
reel/
├── reel-web/        Next.js 15 app (port 3033 dev / 3000 prod inside container)
├── reel-engine/     FastAPI service (port 8002)
├── deploy/          docker-compose + bootstrap + cloudflared notes
├── .github/         CI: lint + multi-arch image build → ghcr.io
├── Makefile         common dev tasks
└── .env.example     all the env vars
```
