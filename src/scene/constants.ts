/** Single source of truth for every tunable number. Tune here only. */

/**
 * Pan mode: scroll advances offset across (1 - panSpan) ≈ 0.56 of the texture.
 * For ~60s: TRAIN_SPEED * biome.speedRatio * 60 ≈ 0.56
 * → TRAIN_SPEED ≈ 0.0093 when speedRatio = 1
 */
export const TRAIN_SPEED = 0.0093;

export const LAYER = {
  sky: { z: -400, speedRatio: 0.003 },
  farHills: { z: -220, speedRatio: 0.02 },
  midBand: { z: -120, speedRatio: 0.05 },
  biome: { z: -55, speedRatio: 1.0 },
  ground: { z: -28, speedRatio: 0.25 },
  trackside: { z: -10, speedRatio: 0.5 },
  nearGrass: { z: -4, speedRatio: 0.7 },
  water: { z: -42, speedRatio: 0.25 },
  waterfall: { z: -65, speedRatio: 0.08 },
  lightShafts: { z: -80, speedRatio: 0.012 },
} as const;

export const CAMERA = {
  fov: 55,
  near: 0.1,
  far: 800,
} as const;

export const FOG = {
  color: 0xeee6d6,
  density: 0.004,
} as const;

export const RENDERER = {
  exposure: 1.05,
  desktopPixelRatioCap: 2,
  mobilePixelRatioCap: 1.5,
} as const;

/** No vertical bounce — AC coach is smooth track. Tiny roll only if enabled. */
export const SWAY = {
  yAmp1: 0,
  yFreq1: 2.1,
  yAmp2: 0,
  yFreq2: 3.7,
  yPhase2: 1.3,
  rollAmp1: 0.0006,
  rollFreq1: 1.2,
  rollAmp2: 0.0003,
  rollFreq2: 2.1,
  rollPhase2: 0.7,
  bumpAmp: 0,
  bumpDuration: 0.4,
  bumpIntervalMin: 99999,
  bumpIntervalMax: 99999,
  reducedMotionScale: 0,
} as const;

export const BIOME = {
  /** Pan ~60s then soft dissolve into next plate (never hard-wrap). */
  durationMin: 50,
  durationMax: 70,
  crossfadeSeconds: 10,
  crossfadeStagger: 1.5,
} as const;

export const DEPARTURE = {
  rampSeconds: 5,
  startSpeedMul: 0.15,
  boardFadeSeconds: 1.2,
  audioFadeSeconds: 3,
} as const;

export const AUDIO = {
  radioGain: 0.8,
  clatterGain: 0.14,
  accentGain: 0.1,
  masterDefault: 0.85,
  gainTau: 0.05,
  clatterPlaybackStart: 0.85,
  clatterPlaybackFull: 1.0,
  eventIntervalMin: 180,
  eventIntervalMax: 360,
} as const;

export const POSTFX = {
  bloomStrength: 0.28,
  bloomRadius: 0.55,
  bloomThreshold: 0.82,
  grainAmp: 0.022,
  vignetteStrength: 0.22,
  caMaxPx: 0.8,
} as const;

export const DT_CLAMP_MS = 50;
export const RESIZE_DEBOUNCE_MS = 150;
export const CHROME_IDLE_MS = 4000;

/** Free HTTPS streams verified by GET (audio/mpeg or AAC body received). */
/**
 * Free HTTPS streams (user-selectable).
 * First station works after radio cold-start buffering fix (don’t treat waiting as instant fail).
 */
export const STATIONS = [
  {
    name: 'Nostalgic Bollywood 90s',
    short: '90s Hits',
    url: 'https://www.desizoneradio.com/relay3',
  },
  {
    name: 'DesiZone Radio',
    short: 'DesiZone',
    url: 'https://www.desizoneradio.com/relay1',
  },
  {
    name: 'Bollywood 2010s',
    short: '2010s',
    url: 'https://drive.uber.radio/uber/bollywood2010s/icecast.audio',
  },
  {
    name: 'Bollywood 2000s',
    short: 'Retro 2000s',
    url: 'https://2.mystreaming.net/uber/bollywood2000s/icecast.audio',
  },
  {
    name: 'Bollywood Love',
    short: 'Love Hits',
    url: 'https://nl4.mystreaming.net/uber/bollywoodlove/icecast.audio',
  },
  {
    name: 'Exclusive Bollywood',
    short: 'Exclusive',
    url: 'https://streaming.exclusive.radio/er/bollywood/icecast.audio',
  },
  {
    name: '0nlineradio LO-FI',
    short: 'Lofi',
    url: 'https://stream.0nlineradio.com/lo-fi?ref=radiobrowser',
  },
  {
    name: 'laut.fm Lofi',
    short: 'Lofi 2',
    url: 'https://stream.laut.fm/lofi',
  },
  {
    name: 'Gazal Radio London',
    short: 'Ghazals',
    url: 'https://streaming.webhostnepal.com/8018/stream',
  },
  {
    name: 'Mixify Bollywood',
    short: 'Mixify',
    url: 'https://server.mixify.in/listen/listen/radio.mp3',
  },
] as const;
