# सफ़र-ए-रेल — Implementation Plan
### An infinite AC 2-Tier train journey through green India, with non-stop 90s Bollywood

**Document purpose:** Complete handover spec for a junior engineer. Everything needed to build, test, and ship v1 is in this document. Read it fully before writing any code. Where a decision is marked **[DECIDED]**, do not re-litigate it — build it as specified. Where marked **[VERIFY]**, you must test/confirm before building on top of it.

---

## 1. Product Definition

### 1.1 What we're building
A single-page web experience. The user "boards" a train and is placed at the **side lower berth of an AC 2-Tier (2A) Indian Railways coach**, looking out of the large sealed window. Outside, an endless, calming Indian landscape rolls past — forests, hills, rivers, paddy fields, waterfalls — rendered in real time with Three.js. A 24/7 90s Bollywood radio stream plays continuously, with low-volume train ambience (track clatter, distant horn) mixed underneath.

There is no game, no navigation, no feed. The product is a **vibe**: you open the tab, you're on a train, you leave it on for hours.

### 1.2 What "done" looks like (acceptance criteria)
- [ ] Loads in < 4 seconds on a mid-range phone over 4G (initial interactive, not all textures).
- [ ] Runs at 60fps on a 2020+ laptop, ≥ 30fps on a mid-range Android phone.
- [ ] Scenery visibly varies over time — a user watching for 5 minutes sees at least 3 distinct landscape types.
- [ ] Music starts reliably after one tap, on iOS Safari, Android Chrome, and desktop browsers.
- [ ] Train ambience is audible but clearly *under* the music (music ~4–5× louder).
- [ ] If the radio stream drops, playback recovers automatically within 10 seconds without user action.
- [ ] The window frame reads unmistakably as an Indian Railways AC coach window, not a generic frame.
- [ ] Tab left open for 2 hours: no memory growth beyond ~15%, no audio drift, no visual glitches.
- [ ] Works with tab in background (audio continues; rendering pauses to save battery).

### 1.3 Explicit non-goals for v1
- No song title display (needs an ICY-metadata proxy — deferred to v1.1).
- No user-selectable routes/destinations.
- No day/night cycle (fixed golden-hour lighting — see §5.6).
- No multiplayer/chat/social features.
- No account, no backend, no database. **This is a static site.**

---

## 2. Tech Stack & Project Setup **[DECIDED]**

| Concern | Choice | Why |
|---|---|---|
| Build tool | Vite (vanilla TS template) | Fast, zero-config, tree-shakes Three.js |
| Language | TypeScript | Junior-friendly guardrails |
| 3D | Three.js (latest stable, npm — **not** r128; that limitation only applied to a different environment) | Full feature set incl. `EffectComposer`, `UnrealBloomPass` |
| Post-processing | `three/examples/jsm/postprocessing/*` | Ships with Three.js |
| Audio | Native `<audio>` for radio + **Web Audio API** graph for ambience/mixing | See §7 |
| Styling | Plain CSS (one file) | The DOM layer is small |
| Hosting | Vercel static deploy | Matches the trend; free tier is fine |
| State | None (module-level singletons) | App is too small for a framework |

**Setup commands:**
```bash
npm create vite@latest safar-e-rail -- --template vanilla-ts
cd safar-e-rail
npm i three
npm i -D @types/three
```

### 2.1 Repository structure
```
safar-e-rail/
├── index.html              # Boarding screen + window-frame DOM + canvas mount
├── public/
│   ├── audio/
│   │   ├── track-clatter-loop.ogg    # + .m4a fallback for Safari
│   │   ├── horn-distant-01.ogg
│   │   ├── horn-distant-02.ogg
│   │   └── crossing-bell.ogg
│   └── textures/
│       ├── sky-gradient.png
│       ├── hills-far-a.png / hills-far-b.png
│       ├── treeline-mid-forest.png / -bamboo.png / -eucalyptus.png
│       ├── ground-paddy.png / ground-scrub.png / ground-tea.png
│       ├── water-river.png + water-normal.png
│       ├── poles-near.png
│       ├── waterfall-strip.png + waterfall-normal.png
│       ├── mist-particle.png
│       └── grain.png
├── src/
│   ├── main.ts             # Boot sequence, boarding gate
│   ├── scene/
│   │   ├── SceneManager.ts # Renderer, camera, resize, RAF loop, visibility handling
│   │   ├── ParallaxLayer.ts# The core reusable class (see §5.2)
│   │   ├── BiomeDirector.ts# Scenery variation over time (see §5.4)
│   │   ├── Water.ts        # River/lake plane (see §5.5)
│   │   ├── Waterfall.ts
│   │   ├── LightShafts.ts
│   │   ├── CameraSway.ts   # Train motion (see §5.7)
│   │   └── PostFX.ts       # Composer: bloom, grain, vignette, CA
│   ├── audio/
│   │   ├── Radio.ts        # Stream element + reconnect logic (see §7.2)
│   │   ├── Ambience.ts     # Train sounds via Web Audio (see §7.3)
│   │   └── Mixer.ts        # Master gain graph, volume persistence
│   ├── ui/
│   │   ├── boarding.ts     # Tap-to-board overlay
│   │   └── controls.ts     # Mute / volume / fullscreen chrome
│   └── style.css
└── vercel.json             # (only if needed for headers)
```

---

## 3. Boot Sequence & The Boarding Screen

Autoplay policy is the hard constraint: **no audio until a user gesture.** We turn that constraint into the product's front door.

### 3.1 Flow
1. `index.html` shows the boarding screen immediately (pure DOM/CSS — no JS needed to paint it). Dark background, a ticket-style card:
   - Title: **सफ़र-ए-रेल**
   - Subtitle: `कोच A1 · बर्थ 33 · साइड लोअर` (Coach A1, Berth 33, Side Lower)
   - A large button: **“ट्रेन में चढ़ें”** (Board the train)
   - Small caption: `90s Bollywood · Non-stop`
2. While the boarding screen is visible, **preload in the background**: Three.js scene construction, texture loading (via `LoadingManager`), and `fetch` + decode of the ambience audio buffers. The button stays disabled with the label “ट्रेन आ रही है…” until the sky, far-hills, and mid-treeline textures are ready (don't block on *all* textures — the rest can stream in).
3. On tap:
   - Create/resume the `AudioContext` (this is the gesture that unlocks audio).
   - Call `radio.play()` (§7.2) and start the ambience loop (§7.3).
   - Fade the boarding screen out over 1.2s (CSS opacity transition) while simultaneously fading master audio gain from 0 → 1 over 3s and ramping scene scroll speed from 0.15× → 1× over 5s. **The train pulls out of the station.** This 5-second departure ramp is a required detail — it sells the whole thing.
4. Boarding screen `display:none` after the transition; never shown again this session.

### 3.2 Edge case
If the user backgrounds the tab mid-boarding, pause the ramp and resume on `visibilitychange`.

---

## 4. The Window Frame (DOM overlay) **[DECIDED: DOM, not 3D geometry]**

The canvas renders the *outside world only*, full-viewport. Everything that makes it a train window is a fixed-position DOM stack on top. This keeps the frame pixel-crisp at any resolution and free.

### 4.1 The AC 2-Tier look — reference details (get these right)
An AC 2A side-lower window is **not** a barred sleeper window. It is:
- A **single large sealed pane**, roughly 2:1 landscape, double-glazed with a **subtle blue-green tint**.
- Rounded-rectangle **brushed-aluminium/off-white frame** with visible rivet/screw dots at corners.
- **Curtains** on a rail above: typically deep blue or maroon, pulled to both sides in soft vertical folds, covering ~8–12% of each edge.
- Below the window: the edge of the **side-lower berth backrest** (blue rexine/vinyl) just entering the bottom of the frame, and optionally the small folding **snack table** edge in a bottom corner.
- Faint **interior reflection** on the glass (a soft light-blue vertical smear suggesting the tube lights and berth opposite).

### 4.2 DOM layer stack (bottom → top)
1. `<canvas>` — the world.
2. `.glass-tint` — full-window `div`, `background: rgba(140, 190, 200, 0.06)` plus a very soft vertical gradient darkening the top 15% (double-glazing effect). `pointer-events: none`.
3. `.glass-reflection` — a semi-transparent PNG or CSS gradient blob, ~10% opacity, that **shifts ±4px with the camera sway** (read a CSS variable that `CameraSway` updates — this one detail makes the glass feel real).
4. `.window-frame` — the frame itself. Build with CSS: outer `border-radius: 28px`, thick border, inner shadow (`box-shadow: inset 0 0 40px rgba(0,0,0,0.5)`) so the world darkens slightly at the edges like real glass.
5. `.curtain-left` / `.curtain-right` — either two prepared PNG images (preferred; commission or hand-make fabric-fold images with alpha) or CSS `repeating-linear-gradient` folds as fallback. They sway ±2px on a slow 7s CSS keyframe, phase-offset from the camera sway.
6. `.berth-edge` — bottom strip PNG (blue rexine texture with a subtle seam) occupying the bottom ~7% of the viewport.
7. `.chrome` — UI controls (§8), top-right, auto-hiding.

### 4.3 Aspect handling
- Landscape (desktop/tablet): frame fills viewport with margins baked into the frame layer.
- Portrait (phone): letterbox — the window becomes a centered 16:10 region, with the areas above/below rendered as coach interior wall color (`#d8d4c8` panel with a faint AC vent graphic above, berth rexine below). Do **not** try to make a portrait train window; it reads wrong.

---

## 5. The World (Three.js)

### 5.1 Scene fundamentals
- `PerspectiveCamera`, FOV **55°**, positioned at origin looking down **−Z**. The world scrolls along **X**; the camera never translates in X.
- Renderer: `antialias: false` (post-FX makes it moot), `powerPreference: "high-performance"`, pixel ratio capped: `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))` desktop, `Math.min(devicePixelRatio, 1.5)` mobile.
- Color management: `renderer.outputColorSpace = SRGBColorSpace`, `ACESFilmicToneMapping`, exposure `1.1`.
- `scene.fog = new THREE.FogExp2(0xdfe8dd, 0.055)` — warm pale green-grey. **[DECIDED]** Exponential fog is the single biggest realism lever here: it separates the depth planes optically so the parallax illusion holds. Tune density last, after all layers exist.

### 5.2 `ParallaxLayer` — the core class
Every scenery band is an instance of this one class. **[DECIDED]** We scroll **texture offsets**, never geometry.

```ts
class ParallaxLayer {
  mesh: THREE.Mesh;            // PlaneGeometry, world-spanning width
  texture: THREE.Texture;      // wrapS = RepeatWrapping, repeat.x = tiles
  speedRatio: number;          // multiplied by global trainSpeed
  update(dt: number, trainSpeed: number) {
    this.texture.offset.x += trainSpeed * this.speedRatio * dt;
    this.texture.offset.x %= 1;   // prevent float drift over hours
  }
  crossfadeTo(nextTexture: THREE.Texture, seconds: number) { ... } // see §5.4
}
```

Crossfading requires a small custom `ShaderMaterial`: two texture samplers + a `mix` uniform, alpha-tested (`discard` below 0.5 alpha) for the cutout layers. Write this shader once; every layer uses it. Keep it under 30 lines of GLSL — sample A, sample B, `mix(a, b, u_mix)`, apply fog via Three's fog shader chunks (`#include <fog_fragment>` etc. — copy the pattern from Three's `MeshBasicMaterial` shader or use `onBeforeCompile` on a `MeshBasicMaterial`, whichever you find easier; the `onBeforeCompile` route gets you fog for free and is recommended).

### 5.3 Layer inventory (back → front)

| # | Layer | Z (depth) | speedRatio | Texture size | Notes |
|---|---|---|---|---|---|
| 0 | Sky | −400 (or scene.background) | 0.008 | 2048×1024 gradient + baked soft clouds | Huge plane, or set as background with a slowly-offsetting cloud plane in front. Warm golden-hour gradient: pale gold horizon → soft blue-white zenith. |
| 1 | Far hills | −220 | 0.05 | 2048×512, alpha cutout | Blue-green silhouette ridges, 2 alternating textures (a/b) for variety |
| 2 | Mid band | −120 | 0.2 | 2048×512, alpha cutout | Second, closer hill/forest silhouette; slightly more saturated |
| 3 | **Biome band** | −60 | 0.45 | 4096×1024, alpha cutout | The star layer: full treelines, village rooftops, temple spire, banana groves — this is what `BiomeDirector` swaps (§5.4) |
| 4 | Ground band | −30 | 0.7 | 4096×512 | Paddy fields / tea gardens / scrubland ground plane, tilted back ~65° so it recedes toward layer 3 |
| 5 | Trackside | −10 | 1.0 | 2048×1024, alpha cutout | Electric poles, km stones, signal posts, occasional bushes. Sparse! One pole every ~1.5 screen-widths. Motion-blur these slightly *in the texture itself* (horizontal 6–10px blur baked in) — at speedRatio 1.0 they'd otherwise strobe. |
| 6 | Near grass blur | −4 | 1.4 | 1024×256 | A low strip of heavily blurred green streaks along the very bottom, 40% opacity. Sells speed more than anything else. |

Plane widths: size each so it over-fills the camera frustum at its Z by ≥ 20% on each side (compute from FOV; don't hardcode — write a `fitPlaneToFrustum(z, overscan)` helper).

**Texture sourcing:** All layer art is stylized-painterly, matching the bus site's illustrated warmth — **not** photos. Options in order of preference: (a) generate with an image model and manually clean seams + alpha in an editor; (b) assemble from CC0 painted asset packs (itch.io parallax packs, adapted to Indian flora — palms, banyans, sal trees, paddy). Every texture must **tile seamlessly in X** — verify each one by setting `repeat.x = 4` in a test scene and eyeballing the seams before integrating. Budget a full day for texture work; it is the majority of the visual quality.

### 5.4 `BiomeDirector` — variation over time **[DECIDED]**
The journey cycles through biomes so it never feels like a loop.

- Biomes for v1 (5): `dense-forest`, `rolling-hills-tea`, `river-valley`, `paddy-plains`, `waterfall-gorge`.
- Each biome is a config object: `{ biomeBandTexture, groundTexture, farHillsVariant, fogDensity, fogColor, hasWater, hasWaterfall, ambientTint }`.
- The director holds a **shuffled queue** (no immediate repeats) and advances every **90–150 seconds** (randomized per segment).
- Transition: over **8 seconds**, crossfade layer 3 and layer 4 textures (via the shader `mix` uniform), lerp fog density/color, and toggle water/waterfall features. Stagger the two layer crossfades by 2s (far one first) so the change reads as *approaching* new terrain rather than a video cut.
- `river-valley` and `waterfall-gorge` enable the Water and Waterfall modules below.

### 5.5 Water (`river-valley` biome, and lakes elsewhere)
A horizontal plane replacing part of the ground band, Z ≈ −45:
- `MeshBasicMaterial`-derived shader with: base texture (painted water, warm sky reflection baked in), plus a **scrolling normal-ish distortion**: sample `water-normal.png` twice at different scales/speeds/directions, use it to offset the base texture UVs by a few texels. This fakes shimmer convincingly at our art style — do **not** attempt real reflections (`Reflector` is a perf trap here). 
- Add 6–10 sparkle sprites (additive, tiny, twinkling via sine-driven opacity) scattered on the water, respawning as they scroll off.
- The water plane scrolls at ground speed (0.7) but its distortion scrolls independently — water should feel *alive*, not just *passing*.

### 5.6 Lighting & time of day **[DECIDED: fixed golden hour]**
Permanent late-afternoon: it's the calmest, prettiest light, it flatters the fog, and it avoids building a day/night system. Bake the lighting into the textures (they're unlit `MeshBasicMaterial`-style anyway). One `DirectionalLight` exists only if you end up using any lit material (waterfall mist can be unlit too — so likely zero lights in the scene). Warmth comes from texture palette + fog color + bloom.

### 5.7 `LightShafts`
2–3 elongated cones (`ConeGeometry`, open-ended), additive blending, opacity ~0.06, pale gold, angled from upper-left, at Z ≈ −80. Slow independent drift (offset.x at 0.03) and a 20s sine on opacity (0.03 ↔ 0.08). They should be *barely* noticeable — if a viewer can point at them, halve the opacity.

### 5.8 `Waterfall` (waterfall-gorge biome)
- An `Object3D` on the mid band (Z ≈ −70): a vertical plane with `waterfall-strip.png` (white-blue painted falls, alpha edges), UV **offset.y** scrolling downward fast (~0.8/s), plus a second copy at 50% opacity scrolling at 0.5/s for depth.
- At its base: 20–30 mist particles — `Sprite`s with `mist-particle.png`, additive, spawning at the base, drifting up-right, fading out over 3s. A dead-simple pooled particle system; do not import a particle library.
- The whole object scrolls with its layer's speed; when it exits frame-left, hide it until the biome next queues it, respawning at a randomized off-screen-right X.

### 5.9 `CameraSway` — the train's motion **[DECIDED]**
```ts
const t = clock.elapsedTime;
camera.position.y = 0.018 * Math.sin(t * 2.1) + 0.011 * Math.sin(t * 3.7 + 1.3);
camera.rotation.z = 0.0028 * Math.sin(t * 1.7) + 0.0016 * Math.sin(t * 4.3 + 0.7);
```
- Two incommensurate frequencies per axis = never-repeating organic rock. Amplitudes above are starting points; the correct final feel is *"noticeable only when you look for it."*
- Every 45–90s (random), trigger a **joint-clack event**: a 0.4s stronger bump (add a quick decaying sine to position.y, amplitude 0.03) **synchronized with the track-clatter accent sound** (§7.3). Audio-visual sync on the bumps is a required detail.
- Export the current sway offsets to CSS variables (`--sway-x/--sway-y`, in px) each frame for the glass-reflection layer (§4.2).

### 5.10 `PostFX` (EffectComposer)
Chain: `RenderPass` → `UnrealBloomPass` (strength 0.35, radius 0.6, threshold 0.85) → custom final `ShaderPass` doing, in one shader: film grain (animated, 0.035 amplitude), vignette (smooth, 0.25 strength), chromatic aberration (radial, max 1.5px at corners). One combined pass, not three — mobile GPUs pay per pass.
- **Mobile tier:** if `renderer.capabilities` / a quick benchmark (measure 60 frames at boot) indicates a weak GPU, drop bloom entirely and keep only the combined grain/vignette pass.

### 5.11 Render loop hygiene
- Single `requestAnimationFrame` loop in `SceneManager`; everything else exposes `update(dt)`.
- Clamp `dt` to 50ms (tab-switch protection).
- On `visibilitychange` → hidden: stop the RAF loop entirely (audio keeps playing — it's independent). On visible: restart, with `dt` reset.
- `window.resize` → debounced (150ms) renderer + composer + camera resize, and recompute plane fits (§5.3).

---

## 6. Speed & Feel Constants (single source of truth)

Create `src/scene/constants.ts` and put **every** magic number there: `TRAIN_SPEED`, layer ratios, fog density, sway amplitudes, biome durations, audio gains, crossfade times. The final tuning session (§10, milestone M6) is done entirely in this file. Nothing tunable may be hardcoded elsewhere. This is a hard requirement — it's the difference between a tunable product and a frozen one.

Starting values: `TRAIN_SPEED = 0.055` (texture-offset units/sec at ratio 1.0). At 2048px-wide trackside textures this reads as ~90–110 km/h. 

---

## 7. Audio Architecture

### 7.1 Signal flow **[DECIDED]**
```
<audio id="radio">──MediaElementSource─┐
                                       ├──radioGain (0.8)──┐
track-clatter loop──BufferSource──clatterGain (0.16)──┐    ├── masterGain ── destination
horn/bell one-shots──BufferSource──accentGain (0.12)──┴────┘
```
- One `AudioContext`, created **inside the boarding tap handler**.
- Radio through `createMediaElementSource` so it shares the master gain (single mute, single volume slider, smooth ducking possible later).
- **[VERIFY — CORS]** `createMediaElementSource` on a cross-origin stream requires the stream server to send `Access-Control-Allow-Origin` and the element to have `crossorigin="anonymous"`, otherwise output is silence. **This is the #1 pre-build check** (§7.5). If the chosen station lacks CORS headers, fallback wiring: radio `<audio>` plays directly to hardware (outside the graph) and ambience runs its own graph; mute/volume then set both `audio.volume` and `masterGain` in parallel. Build the `Mixer` abstraction so either wiring hides behind the same interface.

### 7.2 `Radio.ts`
- `<audio crossorigin="anonymous" preload="none">`, `src` set at boarding time.
- Station config: an ordered array of 2–3 stream URLs (primary + fallbacks), found and verified per §7.5.
- **Reconnect logic (required):** on `error`, `stalled`, or `ended` → wait 2s → reload `src` (cache-bust with `?t=Date.now()`) → `play()`. After 3 consecutive failures on a URL, advance to the next station in the list. After the full list fails twice, show a small toast: “सिग्नल नहीं मिल रहा… रुकिए” and keep retrying every 15s. On any success, reset failure counters.
- Also listen for `waiting` → if `waiting` persists > 8s, treat as stalled.
- iOS: set `audio.setAttribute('playsinline', '')`; keep the element in the DOM.

### 7.3 `Ambience.ts` — the train sounds **[DECIDED: subtle]**
Target mix: with music at reference level, ambience sits **12–16 dB below** it. If someone notices the train sounds before the music, it's too loud.
- **Base loop:** `track-clatter-loop.ogg` — 20–30s seamless loop of interior AC-coach rumble + soft rhythmic *da-dum da-dum*. Decoded via `decodeAudioData`, looped `AudioBufferSourceNode` (sample-accurate looping — never loop an `<audio>` element, it gaps). Source from freesound.org (CC0/CC-BY, credit in README) and loop-edit it yourself in Audacity: crossfade the loop point, verify 10 minutes of playback for clicks.
- **Joint-clack accents:** fired by `CameraSway`'s bump events (§5.9) — play a one-shot louder clack (a marked slice of the clatter recording) through `accentGain`, with ±10% random `playbackRate` so repeats don't sound identical.
- **Occasional events (random, sparse):** every 3–6 min pick one: distant horn (two variants), or a level-crossing bell that pans faintly L→R (use a `StereoPannerNode`, −0.7 → +0.7 over 4s). These are the "oh nice" moments; more than one per 3 minutes ruins them.
- All ambience `playbackRate` scales gently with the departure ramp (§3.1 step 4): 0.85 → 1.0 as the train reaches speed.

### 7.4 `Mixer.ts` & controls
- Master volume slider (0–100) + mute toggle. Persist both in `localStorage`; restore at boarding.
- All gain changes via `setTargetAtTime` (τ ≈ 0.05s) — never set `.value` directly (clicks).

### 7.5 **[VERIFY — do this before writing scene code]** Station selection
Half a day, budgeted. Deliverable: a short markdown note in the repo (`docs/stations.md`) with 3 verified stations.
1. Source candidates from the **radio-browser.info** public API (filter tags: `bollywood`, `90s`, `hindi retro`) and Zeno.FM's Bollywood-retro directory.
2. For each candidate verify, in this order: (a) stream URL is **HTTPS** (mixed-content will be blocked on Vercel); (b) plays in a bare `<audio>` tag; (c) sends `Access-Control-Allow-Origin: *` (check DevTools network tab) — decides the §7.1 wiring; (d) listen for 30+ minutes: is it *actually* 90s-heavy, and are there ads/RJ chatter? Prefer non-stop music stations; (e) leave it playing 24h in a muted tab — did it survive?
3. Rank; primary + two fallbacks into the config.

---

## 8. UI Chrome (`controls.ts`)
Top-right corner, fading to 15% opacity after 4s of no pointer movement (full opacity on move/touch):
- Mute toggle (speaker icon)
- Volume slider (appears on hover/tap of the speaker)
- Fullscreen toggle
- A tiny “ⓘ” → minimal about card: credit line, station credit, “inspired by सफ़र-ए-UP”, GitHub link.
Typography throughout: one Devanagari-capable font (e.g., “Tiro Devanagari Hindi” or “Baloo 2” from Google Fonts, subset via `&text=` to keep it small) + system fallback. All UI copy bilingual-lite: Hindi primary, small English caption.

---

## 9. Performance Budget & Constraints
- **JS bundle** (gzipped): ≤ 250 KB including Three.js (import from `three` — Vite tree-shakes; do not import the whole examples dir).
- **Textures total**: ≤ 9 MB. Use lossy WebP for opaque layers, PNG only where alpha quality demands it. Provide `LoadingManager` progress to the boarding button label.
- **Draw calls**: ≤ 25 typical frame. Each layer is one call; particles are one `Points`/pooled-sprite group per system.
- **Heap**: dispose old biome textures 10s after a crossfade completes (`texture.dispose()`); verify with a 2-hour DevTools memory recording (acceptance §1.2).
- **Battery**: RAF stops when hidden (§5.11); consider `setInterval` at 30fps cap when battery API reports < 20% (nice-to-have, skip if time-pressed).

---

## 10. Milestones (build in this order)

| M | Deliverable | Est. |
|---|---|---|
| M0 | §7.5 station verification note + repo scaffold + Vercel deploy pipeline working (deploy “hello” day 1) | 0.5 d |
| M1 | Boarding screen → canvas with sky + 2 placeholder scrolling layers + working radio with reconnect. *Ship this to a preview URL — it's already 60% of the vibe.* | 1.5 d |
| M2 | Full 7-layer system, `ParallaxLayer` shader crossfade, fog, camera sway, departure ramp | 2 d |
| M3 | Real textures for 2 biomes (`dense-forest`, `rolling-hills-tea`) + `BiomeDirector` transitions | 2 d |
| M4 | Ambience audio graph, joint-clack sync, occasional events, mixer + controls UI | 1 d |
| M5 | Remaining 3 biomes incl. Water + Waterfall + light shafts; window-frame DOM polish (curtains, reflection, berth edge) | 2.5 d |
| M6 | PostFX, mobile tiering, **tuning day** (constants.ts only), QA checklist, 2-hour soak test, launch | 1.5 d |

Total ≈ **11 working days**. After M1 and every milestone onward, deploy to the Vercel preview URL and send the link for review — do not batch reviews to the end.

## 11. QA Checklist (run at M6, all must pass)
- [ ] iOS Safari (real device): tap-to-board starts music; screen-lock → unlock: music resumed or resumes on tap.
- [ ] Android Chrome mid-range device: ≥ 30fps, no thermal throttle collapse within 30 min.
- [ ] Kill network for 30s while playing → radio auto-recovers.
- [ ] Force primary station URL to a 404 → fallback station takes over.
- [ ] 2-hour soak: memory flat, `texture.offset` values still small (the `%= 1` guard), no NaN in sway.
- [ ] Portrait phone shows letterboxed coach-interior treatment, not a stretched window.
- [ ] `prefers-reduced-motion`: halve sway amplitudes and disable the joint-bump (respect it; the scroll itself can stay).
- [ ] Lighthouse performance ≥ 85 mobile on the boarding screen.
- [ ] All audio assets credited in README; all texture licenses recorded in `docs/assets.md`.

## 12. Deferred (v1.1 backlog, do not build now)
- Now-playing song title via a small serverless ICY-metadata proxy (Vercel edge function).
- “Cassette mode”: curated YouTube/playlist toggle as an alternative to radio.
- Chai-walla audio cameo at random “station slowdowns” (train decelerates, platform ambience, speeds back up).
- Rain mode.
- Share-card OG image.
