# Stumped — VPS deployment (backend + web)

Deploys onto the shared-infra VPS (`/srv/infra`: MySQL, Redis, Caddy,
Cloudflare Tunnel). Backend and the public scores site run as containers on
`shared-net`; Caddy reverse-proxies them; the tunnel provides public ingress.

- **API**: `https://api-stumped.adkdev.in`
- **Web**: `https://stumped.adkdev.in/live`

Everything below runs **on the VPS** unless noted.

---

## 1. Get the code onto the VPS

```bash
sudo mkdir -p /srv/stumped && sudo chown "$USER":"$USER" /srv/stumped
git clone https://github.com/Dineshkumargits/stumped.git /srv/stumped
cd /srv/stumped
```

(Private repo? Use a token in the URL or a deploy key. No secrets are committed,
so making it public is also fine.)

## 2. Database + scoped user

```bash
cd /srv/infra
./scripts/create-app-db.sh stumped
```

Copy the printed `DB_USERNAME` / `DB_PASSWORD` (shown once).

Create the tables from the committed DDL (no Prisma needed on the VPS):

```bash
# password is in /srv/infra/.env as DB_ROOT_PASSWORD
docker exec -i -e MYSQL_PWD="$DB_ROOT_PASSWORD" shared-mysql \
  mysql -uroot stumped < /srv/stumped/deploy/schema.sql
```

## 3. App env

```bash
cd /srv/stumped/deploy
cp .env.example .env
$EDITOR .env
```

Set:
- `DATABASE_URL=mysql://stumped:<DB_PASSWORD>@mysql:3306/stumped`
- `JWT_SECRET=$(openssl rand -hex 32)`
- `CORS_ORIGIN=https://stumped.adkdev.in`
- keep `GOOGLE_CLIENT_ID` (the web client id)

## 4. Build + start

```bash
cd /srv/stumped/deploy
docker compose -f docker-compose.prod.yml up -d --build
docker ps --filter name=stumped
docker logs stumped-backend --tail 30      # expect "running on http://0.0.0.0:3005"
```

## 5. Caddy vhost

```bash
cp /srv/stumped/deploy/stumped.caddy /srv/infra/caddy/sites/
docker exec shared-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec shared-caddy caddy reload   --config /etc/caddy/Caddyfile
```

## 6. Cloudflare Tunnel (adkdev.in — separate account)

`adkdev.in` is in a different Cloudflare account than the adkcrackers tunnel, so
it needs its own tunnel:

1. Cloudflare (adkdev.in account) → **Zero Trust → Networks → Tunnels → Create**
   a tunnel (e.g. `stumped-vps`). Copy its **token**.
2. Add the token to `/srv/infra/.env`:
   ```
   TUNNEL_TOKEN_ADKDEV=eyJ...
   ```
3. Add a service to `/srv/infra/docker-compose.yml` (copy the
   `cloudflared-adkcrackers` block):
   ```yaml
   cloudflared-adkdev:
     image: cloudflare/cloudflared:latest
     restart: always
     container_name: shared-tunnel-adkdev
     command: ["tunnel","--no-autoupdate","run","--token","${TUNNEL_TOKEN_ADKDEV:?set in .env}"]
     depends_on: [caddy]
     deploy: { resources: { limits: { memory: 128M } } }
     networks: [shared-net]
   ```
4. Bring it up:
   ```bash
   cd /srv/infra && docker compose up -d cloudflared-adkdev
   ```
5. In that tunnel → **Public Hostnames**, add two, both → service
   `http://shared-caddy:80`:
   - `api-stumped.adkdev.in`
   - `stumped.adkdev.in`

   Cloudflare creates the proxied CNAMEs automatically. **Remove/repoint** the
   old `api-stumped.adkdev.in` route on the dev-box tunnel so it no longer wins.

## 7. Verify

```bash
/srv/infra/scripts/diagnose.sh api-stumped.adkdev.in
curl -s https://api-stumped.adkdev.in/trpc/public.getClub?input=%7B%22code%22%3A%22TURF01%22%7D
# then open https://stumped.adkdev.in/live  (and /live/?code=TURF01)
```

---

## Redeploying after a code change

```bash
cd /srv/stumped && git pull
cd deploy && docker compose -f docker-compose.prod.yml up -d --build
# web changes are picked up immediately (bind-mounted); to be safe:
docker restart stumped-web
```

## Optional: migrate existing dev data

The VPS DB starts empty. To carry over the current club/players from the dev box
instead of re-adding them in the app, on the **dev box**:

```bash
docker exec mysql mysqldump -uroot -p'ADK@mysql1' \
  --single-transaction --no-create-info --skip-triggers stumped > stumped-data.sql
```

Copy `stumped-data.sql` to the VPS, then import (tables already exist from step 2):

```bash
docker exec -i -e MYSQL_PWD="$DB_ROOT_PASSWORD" shared-mysql \
  mysql -uroot stumped < stumped-data.sql
```
