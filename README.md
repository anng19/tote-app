# Tote

A small order-collection app for Shopee/Instagram links. Customers add items
to their own cart under their name; you see every cart in one dashboard.

This is a real standalone app (Node.js + Express), unlike the Claude artifact
version — it uses its own server and its own storage file, so it works
anywhere and the "Storage set failed" error is gone for good.

## Run it locally

You'll need [Node.js](https://nodejs.org) 18 or newer installed.

```
nc
npm start
```

Then open:
- `http://localhost:3000` — the customer order page
- `http://localhost:3000/dashboard.html` — your dashboard (PIN: `2026` by default)

## Change the PIN

Don't ship with the default PIN. Set your own with an environment variable:

```
ADMIN_PIN=your-own-pin npm start
```

## Deploy so anyone can use it on their phone

Any host that runs a Node.js app works. Two easy free options:

### Option A — Render.com
1. Push this folder to a GitHub repo.
2. On [render.com](https://render.com), click **New > Web Service**, connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add an environment variable `ADMIN_PIN` with your own PIN.
5. **Important:** Render's free tier has an ephemeral filesystem — the
   `data/carts.json` file will reset on redeploys/restarts. For anything
   beyond testing, add a persistent disk (Render's paid tier) mounted at
   `/opt/render/project/src/data`, or switch to Railway/Fly.io below.

### Option B — Railway.app
1. Push this folder to a GitHub repo.
2. On [railway.app](https://railway.app), click **New Project > Deploy from GitHub repo**.
3. Add a **Volume** mounted at `/app/data` so `carts.json` survives restarts.
4. Add an environment variable `ADMIN_PIN` with your own PIN.
5. Railway gives you a public URL automatically — share that link.

### Option C — Your own VPS
Copy the folder over (scp/git), run `npm install`, then keep it running with
a process manager:
```
npm install -g pm2
pm2 start server.js --name tote
```
Put it behind a reverse proxy (Caddy or nginx) for HTTPS and a real domain.

## How data is stored

Everything is saved to `data/carts.json` on the server — one entry per
customer name (slugified: "Minh Anh" becomes `minh-anh`). No external
database needed. For a small shop this is plenty; if you outgrow a single
JSON file, swap `readCarts`/`writeCarts` in `server.js` for a real database
(SQLite, Postgres, etc.) — the API routes don't need to change.

## Security note

The dashboard PIN is checked by the server now (not just the page), which is
a real improvement over the Claude-artifact version. It's still a single
shared PIN, not per-user accounts — good enough for a small shop, not for
anything sensitive. Always run behind HTTPS in production (most hosts above
provide this automatically).
