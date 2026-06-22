# Deploying the Image → PDF tool with Coolify

A step-by-step, self-hosted deployment with a domain + free auto-SSL and **no upload size
limit**. You run every command on **your own** server over SSH — no credentials are shared
with anyone.

---

## 0. What you need

- A Linux server (VPS) with a **public IP**. Recommended: **Ubuntu 22.04 / 24.04**, **2 CPU,
  ≥ 2 GB RAM** (4 GB is comfortable — image processing of 50 MB+ files likes headroom),
  ~30 GB disk.
- **Root or a sudo user** via SSH.
- A **domain** (e.g. `pdf.yourdomain.com`) you can edit DNS for.

> The app is already deploy-ready: it reads `PORT`, listens on `0.0.0.0`, and `npm start`
> just works. Coolify builds it with Nixpacks (auto-detects Node, runs `npm install` +
> `npm start`). `sharp` and `heic-convert` install fine on a normal Linux server.

---

## 1. Point your domain at the server (do this first)

In your DNS provider, add an **A record**:

```
Type: A    Name: pdf (or @)    Value: <YOUR_SERVER_IP>    TTL: auto
```

DNS can take a few minutes to propagate. SSL won't issue until this resolves to the server.

---

## 2. Open the firewall ports

SSH into the server, then (if using `ufw`):

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP  (Let's Encrypt + redirect)
sudo ufw allow 443/tcp     # HTTPS (your site)
sudo ufw allow 8000/tcp    # Coolify dashboard
sudo ufw allow 6001/tcp    # Coolify realtime (live logs)
sudo ufw enable
```

---

## 3. Install Coolify (one command, on the server)

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

This installs Docker (if missing) and Coolify. When it finishes it prints the dashboard URL.

---

## 4. Create your Coolify admin account

1. Open **http://<YOUR_SERVER_IP>:8000** in your browser.
2. Register the first admin user (this is the owner account — use a strong password).
3. On the onboarding screen, choose to use the **“localhost / this server”** as the
   deployment server (Coolify manages the machine it's installed on by default).

---

## 5. Add the application

1. **+ New** → **Project** → name it `pdf-compressor` → open it → **Production** environment.
2. **+ New Resource** → **Public Repository** (the repo is public, so no GitHub login needed).
3. Repository URL:
   ```
   https://github.com/Abdullah-Basim/pdf-compressor
   ```
   Branch: **`main`**.
4. **Build Pack:** **Nixpacks** (default — it auto-detects Node.js).
5. **Port / Ports Exposes:** set to **`3000`** (the port the app listens on).
6. Leave install/start commands as detected (`npm install` / `npm start`). If a field is
   blank, set **Start Command:** `npm start`.
7. Save.

---

## 6. Attach the domain + SSL

1. In the application's **Settings → Domains**, enter:
   ```
   https://pdf.yourdomain.com
   ```
   (use `https://` — Coolify auto-provisions a Let's Encrypt certificate via Traefik).
2. Save. Coolify configures the reverse proxy and issues SSL automatically (needs the DNS
   A record from step 1 to be live).

---

## 7. Deploy

Click **Deploy**. Watch the build logs. First build takes a few minutes (installs deps +
sharp's Linux binary). When it goes green, visit **https://pdf.yourdomain.com** — your tool
is live with a padlock.

---

## 8. Auto-deploy on every push (optional, recommended)

For push-to-deploy like Vercel:

- **Easiest:** in the app → **Settings → Webhooks**, copy the deploy webhook URL and add it
  in GitHub → repo **Settings → Webhooks → Add webhook** (content type `application/json`).
  Now every push to `main` redeploys automatically.
- **Or** connect Coolify's **GitHub App** (Sources → GitHub) for native push-to-deploy and
  PR previews.

Until then, you redeploy by clicking **Deploy** (or `git push` + webhook).

---

## 9. Verify it works (incl. large files)

1. Open the live URL, upload a few images of mixed formats → confirm a uniform-A4 PDF.
2. Generate large test files locally and upload them:
   `node scripts/make-large-samples.js` → drag in `large-test-images/` (50 MB+).
3. Confirm large uploads succeed — **Traefik does not cap request body size**, so there's no
   4.5 MB-style limit here.

---

## Notes & troubleshooting

- **No upload cap:** Coolify/Traefik doesn't limit body size. (A manual nginx setup would cap
  at 1 MB until you set `client_max_body_size` — that's why we avoid hand-rolled proxies.)
- **Out-of-memory on huge files:** if a very large batch crashes, give the server more RAM,
  or raise the container memory limit in the app's **Settings → Resource Limits**.
- **Build fails on sharp:** ensure Nixpacks (not a custom Dockerfile) is selected; `npm
  install` pulls the correct `@img/sharp-linux-x64` binary automatically.
- **SSL didn't issue:** confirm the DNS A record points to the server and ports 80/443 are
  open, then redeploy.
- **Keep Coolify itself updated:** Settings → check for updates periodically.

---

## Why this over giving out root access

You install Coolify yourself with one command and manage everything from its dashboard — no
server password is ever shared, and updates/redeploys are a click or a `git push`.
