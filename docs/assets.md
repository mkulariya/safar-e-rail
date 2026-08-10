# Asset licenses

## Textures (panoramic nature plates)
Generated AI landscapes, then offline-processed:

1. **Edge crop (~4–8%)** — removes watermark/logo risk at corners
2. **Soft horizontal stitch** — two plates crossfaded (~16% overlap) for longer pans (forest, tea, river)
3. **Seamless-X blend** — left/right soft-join so scroll loops without hard seams

Files in `public/textures/`:

| File | Content |
|---|---|
| `biome-forest.jpg` | Western Ghats dense forest (stitched long pan) |
| `biome-tea.jpg` | Tea hills + green valleys (stitched) |
| `biome-river.jpg` | River valley + foothills (stitched) |
| `biome-paddy.jpg` | Paddy plains |
| `biome-waterfall.jpg` | Waterfall gorge |
| `biome-konkan.jpg` | Konkan monsoon hills |
| `biome-foothills.jpg` | Himalayan foothills |
| `sky-far.jpg` | Golden-hour sky / far ridges |

**No window frames** in source art — pure outdoor nature only.

## Audio
- Radio: third-party free streams (see `docs/stations.md`) — streamed, not redistributed
- Train ambience: Web Audio synthesis (`src/audio/Ambience.ts`)

## Fonts
- Cormorant Garamond, Inter, Tiro Devanagari Hindi — SIL OFL via Google Fonts

## Libraries
- Three.js, Vite — MIT
