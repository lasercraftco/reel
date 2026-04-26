#!/usr/bin/env bash
# Reel bootstrap — first-time install on iMac (192.168.1.92).
# Idempotent: rerunning is safe.
set -euo pipefail

# Ensure Docker CLI + daemon socket are reachable when bootstrap is run from
# a non-interactive shell (cron, ssh -t, etc.) where the user's PATH and
# DOCKER_HOST aren't picked up. Docker Desktop on macOS exposes its socket at
# ~/.docker/run/docker.sock — without DOCKER_HOST the CLI hangs. (Same gotcha
# fixed for Genome.)
export PATH="/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:${PATH:-}"
export DOCKER_HOST="${DOCKER_HOST:-unix://$HOME/.docker/run/docker.sock}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOMELAB_ENV="$HOME/homelab/.env"
TARGET_DIR="$HOME/homelab/reel"
TUNNEL_HOST_INFRA="${TUNNEL_HOST_INFRA:-infra}"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
die()  { printf "  \033[31m✗\033[0m %s\n" "$1" >&2; exit 1; }

bold "1. Verify environment"
[ -f "$HOMELAB_ENV" ] || die "missing $HOMELAB_ENV — this script expects to run on the iMac"
command -v docker >/dev/null || die "docker not on PATH"
docker info >/dev/null 2>&1 || die "docker daemon not reachable"
ok "docker ok ($(docker --version))"

# shellcheck disable=SC1090
set -a; source "$HOMELAB_ENV"; set +a
: "${TMDB_API_KEY:?TMDB_API_KEY missing in ~/homelab/.env}"
: "${RADARR_KEY:?RADARR_KEY missing in ~/homelab/.env}"
ok "secrets present in ~/homelab/.env"

bold "2. Stage code under ~/homelab/reel"
if [ "$REPO_ROOT" != "$TARGET_DIR" ]; then
  mkdir -p "$(dirname "$TARGET_DIR")"
  if [ -d "$TARGET_DIR" ]; then
    warn "$TARGET_DIR already exists — pulling latest"
    (cd "$TARGET_DIR" && git pull --rebase --autostash)
  else
    cp -R "$REPO_ROOT" "$TARGET_DIR"
    ok "copied repo to $TARGET_DIR"
  fi
fi
cd "$TARGET_DIR"

bold "3. Compose .env"
if [ ! -f .env ]; then cp .env.example .env; fi
update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i.bak "s|^${key}=.*$|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}
update_env TMDB_API_KEY        "$TMDB_API_KEY"
update_env TMDB_READ_TOKEN     "${TMDB_READ_TOKEN:-}"
update_env OMDB_API_KEY        "${OMDB_API_KEY:-}"
update_env TRAKT_CLIENT_ID     "${TRAKT_CLIENT_ID:-}"
update_env TRAKT_CLIENT_SECRET "${TRAKT_CLIENT_SECRET:-}"
update_env TRAKT_ACCESS_TOKEN  "${TRAKT_ACCESS_TOKEN:-}"
update_env RADARR_API_KEY      "$RADARR_KEY"
update_env PLEX_TOKEN          "${PLEX_TOKEN:-}"
update_env PLEX_MACHINE_ID     "${PLEX_MACHINE_ID:-}"
update_env ANTHROPIC_API_KEY   "${ANTHROPIC_API_KEY:-}"
update_env SMTP_HOST           "${SMTP_HOST:-}"
update_env SMTP_PORT           "${SMTP_PORT:-587}"
update_env SMTP_USER           "${SMTP_USER:-}"
update_env SMTP_PASS           "${SMTP_PASS:-}"
update_env SMTP_FROM           "${SMTP_FROM:-Reel <noreply@tyflix.net>}"
update_env TYFLIX_AUTH_JWT_SECRET "${TYFLIX_AUTH_JWT_SECRET:-$(openssl rand -hex 64)}"
update_env TYFLIX_AUTH_JWT_ISSUER "${TYFLIX_AUTH_JWT_ISSUER:-tyflix.net}"
update_env TYFLIX_AUTH_COOKIE_DOMAIN ".tyflix.net"
update_env TYFLIX_OWNER_EMAIL "${TYFLIX_OWNER_EMAIL:-tylerheon@gmail.com}"
update_env REEL_PUBLIC_URL "https://reel.tyflix.net"
update_env POSTGRES_PASSWORD "${REEL_POSTGRES_PASSWORD:-reel-$(openssl rand -hex 8)}"
rm -f .env.bak
chmod 600 .env
ok "wrote .env (chmod 600)"

bold "4. Pull / build images"
docker compose -f deploy/docker-compose.yml --env-file .env pull || true

bold "5. Boot the stack"
docker compose -f deploy/docker-compose.yml --env-file .env up -d --remove-orphans
sleep 4
docker compose -f deploy/docker-compose.yml --env-file .env ps

bold "6. Migrations (web container does this on first boot)"
for _ in {1..20}; do
  if docker logs reel-web 2>&1 | grep -q "migrations applied"; then
    ok "migrations applied"; break
  fi
  sleep 2
done

bold "7. Initial library scan"
curl -fsS -X POST http://localhost:8002/api/library/scan >/dev/null && ok "library scan triggered" || warn "library scan didn't respond yet"

bold "8. Verify endpoints"
curl -fsS http://localhost:3033/api/healthz >/dev/null && ok "web healthz" || warn "web healthz not yet responding"
curl -fsS http://localhost:8002/healthz     >/dev/null && ok "engine healthz" || warn "engine healthz not yet responding"

bold "9. Cloudflare tunnel ingress for reel.tyflix.net"
INGRESS_RULE='  - hostname: reel.tyflix.net\n    service: http://192.168.1.92:3033\n    originRequest:\n      noTLSVerify: true'
if ssh "$TUNNEL_HOST_INFRA" "grep -q 'reel.tyflix.net' /etc/cloudflared/config.yml"; then
  ok "ingress rule already present on $TUNNEL_HOST_INFRA"
else
  warn "adding ingress rule on $TUNNEL_HOST_INFRA"
  ssh "$TUNNEL_HOST_INFRA" "sudo cp /etc/cloudflared/config.yml /etc/cloudflared/config.yml.bak.\$(date +%Y%m%d%H%M%S) && \
    sudo sed -i '/^  - service: http_status:404/i\\
${INGRESS_RULE}' /etc/cloudflared/config.yml && \
    sudo systemctl restart cloudflared"
  ok "tunnel restarted"
fi

bold "10. DNS record (reel → tunnel CNAME)"
if [ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ZONE_ID:-}" ] && [ -n "${CF_TUNNEL_ID:-}" ]; then
  CNAME_TARGET="${CF_TUNNEL_ID}.cfargotunnel.com"
  EXISTING=$(curl -s -H "Authorization: Bearer $CF_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?name=reel.tyflix.net" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['result'][0]['id'] if d.get('result') else '')")
  if [ -z "$EXISTING" ]; then
    curl -s -X POST -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
      "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
      -d "{\"type\":\"CNAME\",\"name\":\"reel\",\"content\":\"$CNAME_TARGET\",\"proxied\":true}" >/dev/null
    ok "created CNAME reel → $CNAME_TARGET"
  else
    ok "DNS record reel.tyflix.net already exists"
  fi
else
  warn "CF_API_TOKEN / CF_ZONE_ID / CF_TUNNEL_ID not set — skipping DNS"
fi

bold "11. Done"
echo ""
echo "  → https://reel.tyflix.net"
echo "  Local: http://192.168.1.92:3033"
echo ""
echo "  Logs:  docker compose -f $TARGET_DIR/deploy/docker-compose.yml logs -f"
echo "  Down:  docker compose -f $TARGET_DIR/deploy/docker-compose.yml down"
