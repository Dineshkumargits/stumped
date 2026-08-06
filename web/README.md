# Stumped — Public Scores Site

A zero-build static site that shows **public, read-only** cricket scores for a
club: live match, past scorecards, leaderboard and series points tables. No app
install, no sign-in — visitors open a link containing the club's invite code.

## Files

- `index.html` — app shell
- `styles.css` — theme (mirrors the mobile app's "Night Turf" look)
- `app.js` — all logic; talks to the backend's `public.*` tRPC endpoints over
  plain HTTP GET

## How access works

- Entry is **code-gated**: a visitor types the club's 6-char invite code, or
  opens a deep link: `https://YOUR_SITE/?code=TURF01`
- Only that club's data is shown. Other clubs stay hidden unless their code is
  shared. (Note: this is a soft gate — the API is genuinely public, so treat any
  shared match/club data as public.)

## Configuring the API URL

`app.js` defaults to the production API:

```js
const API = params.get("api") || window.STUMPED_API || "https://api-stumped.adkdev.in/trpc";
```

Overrides, in priority order:

1. `?api=` query param (handy for local testing):
   `http://localhost:8090/?api=http://127.0.0.1:3000/trpc&code=TURF01`
2. A global set before `app.js` loads: `<script>window.STUMPED_API = "..."</script>`
3. The hard-coded default.

## Local preview

```bash
cd web
python3 -m http.server 8090
# open http://127.0.0.1:8090/?code=TURF01
# (point at a local backend with &api=http://127.0.0.1:3000/trpc)
```

## Deploy (Cloudflare Pages, or any static host)

1. Upload the contents of this `web/` folder as a static site (no build step).
2. Optionally set your own domain, e.g. `scores.adkdev.in`.
3. Share `https://scores.adkdev.in/?code=TURF01`.

## Backend requirements (already implemented, needs redeploy)

The backend now exposes an unauthenticated `public.*` tRPC router and a
configurable CORS allowlist. Before this site works against production:

1. **Redeploy the backend** with the new code (rebuild the Docker image).
2. **Set `CORS_ORIGIN`** to include this site's origin, comma-separated, e.g.:

   ```
   CORS_ORIGIN=http://localhost:8081,https://scores.adkdev.in
   ```

   A single `*` entry reflects any origin (safe here: protected routes still
   require a valid JWT; public routes expose only public data).

That's the only backend config change required.
