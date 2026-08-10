/**
 * Panoramic nature textures — 20 long soft-joined plates in /public/textures/biome-XX.jpg
 */
import * as THREE from 'three';

/** biome-01 … biome-20 — each is one panoramic plate, soft-looped only at edges */
export const BIOME_COUNT = 20;

export type BiomeKind = string; // e.g. 'biome-01'

export function biomeId(n: number): string {
  const i = ((n - 1) % BIOME_COUNT) + 1;
  return `biome-${String(i).padStart(2, '0')}`;
}

export function biomeUrl(id: string): string {
  return `/textures/${id}.jpg`;
}

function allBiomeIds(): string[] {
  return Array.from({ length: BIOME_COUNT }, (_, i) => biomeId(i + 1));
}

function canvasToTexture(
  canvas: HTMLCanvasElement,
  opts: { wrap?: boolean; colorSpace?: boolean } = {},
): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  if (opts.colorSpace !== false) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = opts.wrap !== false ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/**
 * Load image to texture without edge-blending.
 * Pan mode never wraps, so left/right edges of the photo never meet —
 * blending them only created the visible vertical “join” lines.
 */
function makePanTexture(
  img: HTMLImageElement,
  targetW = 2048,
  targetH = 768,
): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = targetW;
  c.height = targetH;
  const ctx = c.getContext('2d')!;
  // Cover-fit, no edge smear
  const scale = Math.max(targetW / img.width, targetH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const ox = (targetW - dw) / 2;
  const oy = (targetH - dh) / 2;
  ctx.drawImage(img, ox, oy, dw, dh);
  const tex = canvasToTexture(c, { wrap: false });
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

let cache: Partial<Record<string, THREE.Texture>> = {};

export async function preloadAllTextures(
  onProgress?: (p: number) => void,
): Promise<void> {
  const urls = ['/textures/sky-far.jpg', ...allBiomeIds().map(biomeUrl)];
  let done = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        const img = await loadImage(url);
        const isBiome = url.includes('biome-');
        cache[url] = makePanTexture(
          img,
          isBiome ? 3200 : 2048,
          isBiome ? 900 : 768,
        );
      } catch {
        /* procedural on demand */
      }
      done++;
      onProgress?.(done / urls.length);
    }),
  );
}

function getCached(url: string): THREE.Texture | null {
  return cache[url] ?? null;
}

function cloneTex(t: THREE.Texture): THREE.Texture {
  const c = t.clone();
  c.needsUpdate = true;
  return c;
}

export function makeSkyTexture(): THREE.Texture {
  const cached = getCached('/textures/sky-far.jpg');
  if (cached) return cloneTex(cached);
  return proceduralSky();
}

export function makeFarHillsA(): THREE.Texture {
  return makeBiomeTexture('biome-02');
}
export function makeFarHillsB(): THREE.Texture {
  return makeBiomeTexture('biome-05');
}

export function makeMidBand(_variant = 0): THREE.Texture {
  return makeBiomeTexture('biome-03');
}

export function makeBiomeTexture(kind: string): THREE.Texture {
  // Accept 'biome-01' or legacy names → map to numbered plate
  let id = kind;
  if (!kind.startsWith('biome-')) {
    const legacy: Record<string, string> = {
      'dense-forest': 'biome-01',
      'rolling-hills-tea': 'biome-03',
      'river-valley': 'biome-05',
      'paddy-plains': 'biome-07',
      'waterfall-gorge': 'biome-09',
      'konkan-coast': 'biome-11',
      'foothills': 'biome-13',
    };
    id = legacy[kind] ?? 'biome-01';
  }
  const url = biomeUrl(id);
  const cached = getCached(url);
  if (cached) return cloneTex(cached);
  return proceduralBiome(id);
}

export function makeGroundTexture(kind: string): THREE.Texture {
  return makeBiomeTexture(kind);
}

export function makeTracksideTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 4;
  return canvasToTexture(c);
}

export function makeNearGrassTexture(): THREE.Texture {
  const w = 1024;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 30 + Math.random() * 80;
    const g = 70 + Math.random() * 80;
    ctx.strokeStyle = `rgba(${20 + Math.random() * 40},${g},${15 + Math.random() * 30},${0.35 + Math.random() * 0.4})`;
    ctx.lineWidth = 1.5 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
  return canvasToTexture(c);
}

export function makeWaterTexture(): THREE.Texture {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#9ec9d8');
  g.addColorStop(0.35, '#5a9eb0');
  g.addColorStop(0.7, '#3a7a8c');
  g.addColorStop(1, '#2a5a6a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return canvasToTexture(c);
}

export function makeWaterNormal(): THREE.Texture {
  const w = 512;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n1 = Math.sin(x * 0.08) * Math.cos(y * 0.07);
      const n2 = Math.sin(x * 0.15 + 1) * Math.cos(y * 0.12);
      const i = (y * w + x) * 4;
      img.data[i] = 128 + n1 * 60;
      img.data[i + 1] = 128 + n2 * 60;
      img.data[i + 2] = 200;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = canvasToTexture(c, { colorSpace: false });
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function makeWaterfallStrip(): THREE.Texture {
  const w = 256;
  const h = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  for (let x = 0; x < w; x++) {
    const edge = Math.pow(Math.min(x, w - 1 - x) / (w * 0.5), 1.4);
    for (let y = 0; y < h; y++) {
      const n = 0.5 + 0.5 * Math.sin(y * 0.08 + x * 0.2) * Math.sin(y * 0.03);
      const a = edge * (0.45 + n * 0.55);
      if (a < 0.08) continue;
      const v = 200 + n * 55;
      ctx.fillStyle = `rgba(${v},${v + 15},255,${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvasToTexture(c);
}

export function makeMistParticle(): THREE.Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return canvasToTexture(c, { wrap: false });
}

export function makeGrainTexture(): THREE.Texture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = canvasToTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function proceduralSky(): THREE.Texture {
  const w = 2048;
  const h = 1024;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#6ba3d0');
  g.addColorStop(0.3, '#a8cce0');
  g.addColorStop(0.55, '#e8d4a8');
  g.addColorStop(0.75, '#f0b86a');
  g.addColorStop(1, '#e89850');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return canvasToTexture(c);
}

function proceduralBiome(_kind: string): THREE.Texture {
  const w = 2048;
  const h = 768;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8ec5e8');
  g.addColorStop(0.4, '#4a7c59');
  g.addColorStop(1, '#1b4332');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return canvasToTexture(c);
}
