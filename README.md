# सफ़र-ए-रेल · Safar-e-Rail

An infinite **AC 2-Tier** train journey through green India, with non-stop **90s Bollywood** radio.

Open the tab → choose one of **10 trains** and its route → board → look out the window.

## Features

- **Onboarding:** pick a famous train (major cities only) and board with a ticket-style pass
- **Parallax world:** Seven depth layers, fog, camera sway, biome changes every ~2 minutes
- **Biomes:** dense forest, tea hills, river valley, paddy plains, waterfall gorge
- **Window frame:** AC coach glass, curtains, berth edge, glass reflections tied to sway
- **Audio:** free Bollywood/retro streams with auto-reconnect + subtle train ambience
- **Static site:** no backend, deploy anywhere

## Dev

```bash
npm install
npm run dev
```

## Deploy (Cloudflare Pages)

**Detailed step-by-step (Git, direct upload, Wrangler, custom domain, troubleshooting):**

👉 **[docs/deploy-cloudflare.md](docs/deploy-cloudflare.md)**

### Short version

```bash
npm install
npm run build          # output → dist/
npm run preview        # optional local production check → http://localhost:4173
```

| Cloudflare Pages setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | *(empty)* |
| Env var | `NODE_VERSION` = `20` |
| Production branch | `main` |

**Recommended path:** push this repo to GitHub → Cloudflare Dashboard → **Workers & Pages** → **Create** → **Connect to Git** → fill the table above → **Save and Deploy**.

**CLI alternative:**

```bash
npx wrangler login
npx wrangler pages deploy dist --project-name=safar-e-rail
```

**Custom domain** (optional, e.g. `.top`): Pages project → **Custom domains** → add domain (free SSL). Full DNS steps are in the deploy guide.

## Stack

Vite · TypeScript · Three.js · Web Audio API · plain CSS

## Radio stations

See [docs/stations.md](docs/stations.md). Streams are free online stations (Zeno.fm / radio-browser).

## License notes

See [docs/assets.md](docs/assets.md).
