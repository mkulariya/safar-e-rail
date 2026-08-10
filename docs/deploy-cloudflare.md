# Deploy सफ़र-ए-रेल on Cloudflare Pages — full step-by-step

This guide takes you from a local clone of **Safar-e-Rail** to a public HTTPS site on **Cloudflare Pages**, with optional custom domain (e.g. `.top`).

No backend, no database, no paid plan required for a typical personal launch.

---

## Table of contents

1. [What you are deploying](#1-what-you-are-deploying)
2. [Prerequisites](#2-prerequisites)
3. [Pre-flight: build and test locally](#3-pre-flight-build-and-test-locally)
4. [Choose a deploy method](#4-choose-a-deploy-method)
5. [Method A — GitHub → Cloudflare Pages (recommended)](#5-method-a--github--cloudflare-pages-recommended)
6. [Method B — Direct upload of `dist/`](#6-method-b--direct-upload-of-dist)
7. [Method C — Wrangler CLI](#7-method-c--wrangler-cli)
8. [After deploy: verify the live site](#8-after-deploy-verify-the-live-site)
9. [Custom domain](#9-custom-domain)
10. [Headers, caching, SPA notes](#10-headers-caching-spa-notes)
11. [Updating after go-live](#11-updating-after-go-live)
12. [Troubleshooting](#12-troubleshooting)
13. [Launch checklist](#13-launch-checklist)
14. [Quick reference card](#14-quick-reference-card)

---

## 1. What you are deploying

| Fact | Detail |
|---|---|
| App type | Static SPA (single-page app) |
| Build tool | Vite + TypeScript |
| Runtime in production | **None** — only static files on a CDN |
| Build output folder | `dist/` |
| Host | [Cloudflare Pages](https://pages.cloudflare.com/) |
| Free tier | Yes — unlimited requests on Free plan for typical use; free `*.pages.dev` hostname + free SSL |
| Secrets / API keys | **None** for v1 (radio streams are public HTTPS URLs) |

**What Cloudflare does for you**

1. Runs `npm install` + `npm run build` (Git method).
2. Publishes everything inside `dist/` to the global Cloudflare CDN.
3. Serves HTTPS automatically.
4. Applies `dist/_headers` (copied from `public/_headers` by Vite).

**What you do not need**

- Cloudflare Workers (unless you add them later)
- A Node.js server
- Environment secrets for the app itself
- Vercel / Netlify / Firebase (this guide is Cloudflare-only)

---

## 2. Prerequisites

### Accounts

| Item | Required? | How to get it |
|---|---|---|
| [Cloudflare account](https://dash.cloudflare.com/sign-up) | **Yes** | Free email signup |
| [GitHub](https://github.com) (or GitLab / Bitbucket) | Strongly recommended | Free account for Method A |
| Domain (e.g. `something.top`) | Optional | Cloudflare Registrar or any registrar |

### On your machine

| Tool | Version | Why |
|---|---|---|
| Node.js | **20** or newer LTS | Local build + CLI deploy |
| npm | Comes with Node | Install deps / build |
| Git | Any recent | Push source for Method A |
| Modern browser | Chrome / Firefox / Safari / Edge | Verify WebGL + audio |

Check versions:

```bash
node -v    # should print v20.x or higher
npm -v
git -v
```

If Node is too old, install from [nodejs.org](https://nodejs.org/) or use `nvm`:

```bash
nvm install 20
nvm use 20
```

### Project settings (memorize these)

You will type these into the Cloudflare dashboard:

| Cloudflare field | Value for this repo |
|---|---|
| Framework preset | **Vite** (or **None**) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(leave empty)* — app lives at repo root |
| Production branch | `main` (or `master` if that is your default) |
| Environment variable | `NODE_VERSION` = `20` |

---

## 3. Pre-flight: build and test locally

Always do this **before** the first Cloudflare deploy. Catches TypeScript and asset mistakes early.

### 3.1 Install dependencies

```bash
cd /path/to/safar-e-rail
npm install
```

### 3.2 Production build

```bash
npm run build
```

This runs `tsc && vite build`. On success you should see something like:

```text
✓ built in …ms
```

### 3.3 Confirm `dist/` contents

```bash
ls dist/
ls dist/textures/ | head
ls dist/assets/
```

You want at least:

```text
dist/
  index.html
  _headers          ← from public/_headers (cache + security)
  favicon.svg
  hero-train.jpg
  assets/           ← hashed JS + CSS (e.g. index-XXXX.js)
  textures/
    biome-01.jpg … biome-20.jpg
    ground.jpg, mid-hills.jpg, sky-far.jpg
```

If `textures/` is missing, the scenery will be black/blank on the live site — fix that before deploying.

### 3.4 Preview the production build

```bash
npm run preview
```

Open **http://localhost:4173** (or the port Vite prints).

Smoke test:

1. Landing page: title, hero image, train dropdown.
2. Pick a train → **Board**.
3. Scenery should pan; radio should start after the click (autoplay policy).
4. Switch station, volume, mute, about, back to boarding.
5. Resize window / try fullscreen once.

Only proceed when local preview feels good.

---

## 4. Choose a deploy method

| Method | Best for | Auto-redeploy on push? | Difficulty |
|---|---|---|---|
| **A. Connect Git** | Ongoing project, normal updates | **Yes** | Easy (one-time setup) |
| **B. Dashboard upload** | One-off demo, no Git remote yet | No | Easiest first publish |
| **C. Wrangler CLI** | Scripted deploys, CI, power users | Optional | Medium |

**Recommendation:** Method **A** for real launch. Use **B** or **C** if you only need a URL today.

---

## 5. Method A — GitHub → Cloudflare Pages (recommended)

### A1. Make sure the repo is clean to push

From the project root:

```bash
cd /path/to/safar-e-rail
```

Ensure `.gitignore` ignores build junk (this repo already does):

```text
node_modules
dist
.env
*.local
```

**Do not commit secrets.** This app does not need a `.env` for v1. Never commit real credential files.

Optional check:

```bash
git status
```

### A2. Create a GitHub repository

1. Open [github.com/new](https://github.com/new).
2. **Repository name:** e.g. `safar-e-rail`.
3. Visibility: **Public** or **Private** (Cloudflare can deploy private repos if you authorize it).
4. **Do not** add a README / license / `.gitignore` if your local folder already has files (avoids merge friction).
5. Click **Create repository**.

### A3. Push local code to GitHub

If the folder is not a git repo yet:

```bash
git init
git add .
git commit -m "Initial commit: Safar-e-Rail ready for Cloudflare Pages"
git branch -M main
git remote add origin https://github.com/YOUR_USER/safar-e-rail.git
git push -u origin main
```

If it is already a git repo with commits:

```bash
git remote add origin https://github.com/YOUR_USER/safar-e-rail.git   # if missing
git branch -M main
git push -u origin main
```

Use SSH if you prefer:

```bash
git remote add origin git@github.com:YOUR_USER/safar-e-rail.git
git push -u origin main
```

Confirm on GitHub that you see `src/`, `public/textures/`, `package.json`, etc.

### A4. Open Cloudflare Pages

1. Log in: [dash.cloudflare.com](https://dash.cloudflare.com).
2. In the left sidebar, open **Workers & Pages**  
   (on some accounts this is under **Compute → Workers & Pages**).
3. Select the **Pages** tab (not Workers).
4. Click **Create application** (or **Create project**).
5. Choose **Pages** → **Connect to Git**.

### A5. Connect GitHub to Cloudflare

1. Choose **GitHub**.
2. If this is the first time, Cloudflare opens a GitHub OAuth / GitHub App install screen.
3. Grant access to:
   - **All repositories**, or
   - **Only** `safar-e-rail` (safer).
4. Back in Cloudflare, select **safar-e-rail** from the list.
5. Click **Begin setup** (or **Continue**).

### A6. Configure the build

Fill the form carefully:

| Field | What to enter |
|---|---|
| **Project name** | `safar-e-rail` (letters, numbers, hyphens). Becomes `https://safar-e-rail.pages.dev` if available |
| **Production branch** | `main` |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | leave **blank** |

#### Environment variables (recommended)

Expand **Environment variables** (or **Settings → Environment variables** after first deploy):

| Variable name | Value | Environment |
|---|---|---|
| `NODE_VERSION` | `20` | Production (+ Preview if listed) |

Without this, Cloudflare may use an older Node and the build can fail or behave oddly.

Click **Save and Deploy**.

### A7. Watch the first build

1. Cloudflare clones the repo.
2. Runs `npm install` (or the detected package manager).
3. Runs `npm run build`.
4. Uploads `dist/` to the edge.

First build often takes **1–4 minutes** (Three.js + many texture files).

Statuses:

- **Building** → wait
- **Success** → open the Production URL
- **Failed** → open the build log (see [Troubleshooting](#12-troubleshooting))

Your production URL looks like:

```text
https://safar-e-rail.pages.dev
```

(Exact subdomain = project name you chose, if available.)

### A8. Branch previews (automatic)

With Git connected:

- Push to a **non-production** branch, or open a **Pull Request** → Cloudflare builds a **Preview** URL, e.g.  
  `https://<commit-hash>.safar-e-rail.pages.dev`
- Merge / push to `main` → updates **Production**.

Use previews to test station or scenery changes before going live.

---

## 6. Method B — Direct upload of `dist/`

Use this when you want a public URL **without** connecting Git.

### B1. Build locally

```bash
cd /path/to/safar-e-rail
npm install
npm run build
```

### B2. Upload in the dashboard

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Pages**.
2. **Create application** → **Upload assets** (sometimes labeled **Direct Upload**).
3. **Project name:** e.g. `safar-e-rail`.
4. Drag and drop:
   - Prefer the **contents** of `dist/` (so `index.html` is at the site root), **or**
   - Follow the UI: some screens accept the `dist` folder and treat it as the root.
5. Click **Deploy site**.

After deploy, open `https://<project-name>.pages.dev`.

### B3. Limitations

- No automatic rebuild when you change code.
- Each update: rebuild locally, then upload again (or switch to Method A / C).

---

## 7. Method C — Wrangler CLI

Good for scripting and re-deploys from a terminal.

### C1. Install and log in

```bash
# One-time: install Wrangler globally, or use npx without install
npm install -g wrangler

npx wrangler login
```

A browser window opens; approve the Cloudflare account.

### C2. Deploy

```bash
cd /path/to/safar-e-rail
npm install
npm run build
npx wrangler pages deploy dist --project-name=safar-e-rail
```

- First run may ask to create the Pages project — confirm.
- Subsequent runs replace the production deployment for that project.

### C3. Optional `wrangler.toml` in the repo

You can keep a minimal config at the project root (optional; dashboard Git settings still control CI builds):

```toml
name = "safar-e-rail"
compatibility_date = "2024-11-01"
pages_build_output_dir = "dist"
```

Then:

```bash
npx wrangler pages deploy dist
```

---

## 8. After deploy: verify the live site

Open the Production URL and run this checklist.

### Functional

- [ ] Landing loads (Hindi/English title, hero image).
- [ ] Train dropdown lists trains; selecting one updates route text.
- [ ] **Board** enters the coach; scenery is visible (not black).
- [ ] Radio starts after boarding (user gesture satisfies autoplay).
- [ ] Station menu switches streams; status does not stick on “failed” forever.
- [ ] Volume slider + mute work.
- [ ] About panel shows berth **25** and readable Devanagari.
- [ ] Back returns to boarding.
- [ ] Fullscreen works once.

### Technical (browser DevTools)

1. Open **Network**.
2. Reload hard (`Ctrl+Shift+R` / `Cmd+Shift+R`).
3. Confirm **200** for:
   - `/` or `/index.html`
   - `/assets/index-*.js`
   - `/assets/index-*.css`
   - `/textures/biome-01.jpg` (and others as they load)
4. **Console** should have no hard errors about missing modules.
5. If the page is blank white, almost always a wrong **output directory** (e.g. set to `public` instead of `dist`) or a failed JS load.

### Devices

- [ ] Desktop Chrome / Firefox.
- [ ] Phone (Safari iOS or Chrome Android) — touch boarding + radio.

---

## 9. Custom domain

### 9.1 Free default hostname

Every project gets:

```text
https://<project-name>.pages.dev
```

SSL is automatic. Fine for sharing while you decide on a domain.

### 9.2 Buy a cheap domain (optional)

Indicative only — always check live prices:

| TLD | Notes |
|---|---|
| `.top` | Often cheap first year; check **renewal** price |
| `.com` | Higher, more “standard” |
| Cloudflare Registrar | At-cost pricing, DNS already on Cloudflare |

**Tip:** Prefer registering at **Cloudflare Registrar** if you want the simplest SSL + DNS path for Pages.

### 9.3 Attach domain when DNS is on Cloudflare

1. Open your Pages project.
2. Go to **Custom domains**.
3. **Set up a custom domain**.
4. Enter e.g. `safarerail.top` or `www.safarerail.top`.
5. Confirm. Cloudflare creates the DNS record and issues a free certificate.
6. Wait until status is **Active** (often minutes; rarely longer).

### 9.4 Domain registered elsewhere (Porkbun, Namecheap, GoDaddy, …)

**Option 1 — Full DNS on Cloudflare (recommended)**

1. Cloudflare dashboard → **Websites** → **Add a site** → enter the domain.
2. Choose Free plan for DNS.
3. Cloudflare shows two **nameservers**.
4. At your registrar, change nameservers to Cloudflare’s.
5. Wait for nameserver update (minutes to 48h).
6. Pages project → **Custom domains** → add `yourdomain.top`.
7. Cloudflare finishes CNAME / apex setup + SSL.

**Option 2 — Keep DNS at the registrar**

1. Pages → **Custom domains** → add domain.
2. Cloudflare shows the target (usually a **CNAME** to `<project>.pages.dev`).
3. At the registrar, create that CNAME (or ALIAS/ANAME for apex if supported).
4. Wait for SSL **Active**.

**Apex (`example.top` without `www`):**  
Cloudflare supports this via CNAME flattening when the zone is on Cloudflare. Easiest if the domain’s DNS is hosted on Cloudflare.

### 9.5 `www` vs bare domain

Common pattern:

- Custom domain: `safarerail.top`
- Optional second: `www.safarerail.top` → redirect to apex (or reverse)

Configure both under **Custom domains** if you want both hostnames to work.

---

## 10. Headers, caching, SPA notes

### Headers file

Source: `public/_headers`  
Copied into `dist/_headers` on every Vite build.  
Cloudflare Pages reads `_headers` automatically.

Current policy (summary):

| Path | Behavior |
|---|---|
| Global | `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` |
| `/assets/*` | Long cache (`immutable`) — safe because filenames are hashed |
| `/textures/*` | 1-day cache — panoramas can update without year-long wait |
| `/hero-train.jpg` | 1-day cache |

After editing `_headers`, commit + redeploy (or rebuild + re-upload).

### SPA routing

The app is a **single** `index.html` with no client-side multi-path router.  
You do **not** need a `_redirects` file for v1.

If you later add paths like `/about` handled only in JS, add `public/_redirects`:

```text
/*    /index.html   200
```

### HTTPS and mixed content

Pages always serves the site over HTTPS. Radio URLs in the app are HTTPS.  
Do not point stations at plain `http://` streams or browsers may block them as mixed content.

---

## 11. Updating after go-live

### Method A (Git)

```bash
# make code or texture changes
git add .
git commit -m "Update stations / scenery"
git push origin main
```

Cloudflare rebuilds Production automatically. Watch the deploy log in the Pages project.

### Method B (upload)

```bash
npm run build
# upload dist/ again in the dashboard
```

### Method C (CLI)

```bash
npm run build
npx wrangler pages deploy dist --project-name=safar-e-rail
```

### Rollbacks

In the Pages project → **Deployments**:

1. Find a previous successful deployment.
2. Use **Retry deployment** / **Rollback** (wording varies) to restore that version.

### Radio station changes

Streams live in `src/scene/constants.ts` (`STATIONS`).  
Edit → rebuild → redeploy. Document streams in `docs/stations.md` when you change them.

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Build fails: Node / engine errors | Wrong Node on CF | Set env `NODE_VERSION=20` |
| Build fails: `tsc` errors | TypeScript errors in source | Run `npm run build` locally; fix errors; push |
| Success but blank white page | Wrong output dir (e.g. `public`) | Set output to **`dist`**; redeploy |
| Blank page; JS 404 | Base path wrong or incomplete upload | Confirm `dist/assets/*` exists; upload **contents** of `dist` |
| Scenery black / missing images | Textures not in repo or not in `dist` | Commit `public/textures/*`; rebuild; check Network for 404 |
| CSS looks unstyled | CSS 404 | Same as assets path issue |
| Radio never starts | Autoplay blocked | User must click **Board**; try another station |
| Radio “failed” on first station | Stream cold-start or dead URL | Wait; switch station; update `STATIONS` if stream died |
| Old UI after deploy | Browser / CDN cache | Hard refresh; hashed assets should bust cache for JS/CSS |
| Custom domain pending SSL | DNS not propagated | Verify CNAME / nameservers; wait; recheck Custom domains |
| Preview works, Production does not | Wrong production branch | Production branch must be the branch you push to (`main`) |
| Large build / timeout | Rare with free tier + many assets | Ensure only needed textures in `public/`; retry deploy |

### Read the build log

Pages project → failed deployment → **View build log**.

Look for:

- `npm ERR!`
- `error TS…` (TypeScript)
- `Could not resolve…`
- Exit code non-zero at the end

### Local parity command

```bash
rm -rf dist node_modules
npm install
npm run build
npm run preview
```

If this fails, Cloudflare will fail the same way.

---

## 13. Launch checklist

### Before first public share

- [ ] `node -v` is 20+
- [ ] `npm run build` succeeds
- [ ] `npm run preview` looks correct (desktop)
- [ ] Textures present under `dist/textures/`
- [ ] `public/_headers` present (copied to `dist/_headers`)
- [ ] Repo on GitHub (if Method A)
- [ ] Cloudflare Pages project created with:
  - Build: `npm run build`
  - Output: `dist`
  - `NODE_VERSION=20`
- [ ] Production deploy status **Success**
- [ ] Live URL opens and boards a train
- [ ] Radio works after one click
- [ ] Tested on a phone
- [ ] (Optional) Custom domain **Active** with HTTPS padlock
- [ ] (Optional) Project / domain name matches brand (Safar-e-Rail)

### Nice-to-haves (not required)

- [ ] Private GitHub repo + Cloudflare GitHub App limited to that repo
- [ ] Preview branch workflow for big changes
- [ ] Bookmark the Pages **Deployments** page for rollbacks

You’re live when:

```text
https://<your-project>.pages.dev
```

(or your custom domain) loads the boarding screen and plays the journey after **Board**.

---

## 14. Quick reference card

```text
Local build:     npm install && npm run build
Local preview:   npm run preview          → http://localhost:4173
Output folder:   dist/

Cloudflare Pages
  Framework:     Vite
  Build command: npm run build
  Output dir:    dist
  Node:          NODE_VERSION=20
  Branch:        main

Git deploy:      push to main → auto rebuild
CLI deploy:      npx wrangler pages deploy dist --project-name=safar-e-rail
Default URL:     https://<project-name>.pages.dev
Custom domain:   Pages → Custom domains → add domain → wait SSL Active

Headers file:    public/_headers  →  dist/_headers
App secrets:     none for v1
```

---

## Related docs

| Doc | Purpose |
|---|---|
| [stations.md](./stations.md) | Radio station list and notes |
| [assets.md](./assets.md) | Texture / media licensing notes |
| [../README.md](../README.md) | Project overview + short deploy pointer |

---

*Safar-e-Rail is a static Vite site. Cloudflare Pages is the intended production host.*
