# Cloudflare tunnel ingress for reel.tyflix.net

The tunnel runs on `infra` (192.168.1.94) as the systemd `cloudflared.service`
unit.

To add the route, on `infra`:

```bash
sudo nano /etc/cloudflared/config.yml
```

Add **above** the catch-all:

```yaml
ingress:
  # ... existing rules ...
  - hostname: reel.tyflix.net
    service: http://192.168.1.92:3033
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s

  - service: http_status:404
```

```bash
sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate
sudo systemctl restart cloudflared
```

Add CNAME `reel → <TUNNEL_ID>.cfargotunnel.com`. The bootstrap script handles
this idempotently if `CF_API_TOKEN`, `CF_ZONE_ID`, `CF_TUNNEL_ID` are set.
