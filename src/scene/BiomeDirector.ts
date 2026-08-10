import * as THREE from 'three';
import { BIOME, FOG } from './constants';
import { ParallaxLayer } from './ParallaxLayer';
import { makeBiomeTexture, makeGroundTexture, BIOME_COUNT, biomeId } from './textures';
import { Water } from './Water';
import { Waterfall } from './Waterfall';

export type BiomeId = string;

interface BiomeConfig {
  id: BiomeId;
  fogDensity: number;
  fogColor: number;
  hasWater: boolean;
  hasWaterfall: boolean;
}

const BIOMES: BiomeConfig[] = Array.from({ length: BIOME_COUNT }, (_, i) => {
  const id = biomeId(i + 1);
  const fogColors = [0xe8e0d0, 0xeee4d4, 0xe4e8e4, 0xf2ead8, 0xe0e4e4, 0xe8e4d8, 0xe4e0dc];
  return {
    id,
    fogDensity: 0.004 + (i % 5) * 0.0006,
    fogColor: fogColors[i % fogColors.length],
    hasWater: false,
    hasWaterfall: false,
  };
});

/**
 * Advances plates based on pan progress (not hard texture wrap).
 * When the window approaches the right edge of a panorama, soft-crossfade
 * into the next plate starting from the left — no vertical seam ever shown.
 */
export class BiomeDirector {
  private queue: BiomeConfig[] = [];
  private current: BiomeConfig;
  private transitioning = false;
  private transitionT = 0;
  private fromFogD: number;
  private toFogD: number;
  private fromFogC = new THREE.Color();
  private toFogC = new THREE.Color();
  private nextBiome: BiomeConfig | null = null;
  private minDwell = 0;
  private dwellTimer = 0;

  private scene: THREE.Scene;
  private biomeLayer: ParallaxLayer;
  private groundLayer: ParallaxLayer;
  private farHills: ParallaxLayer;
  private water: Water;
  private waterfall: Waterfall;

  constructor(
    scene: THREE.Scene,
    biomeLayer: ParallaxLayer,
    groundLayer: ParallaxLayer,
    farHills: ParallaxLayer,
    water: Water,
    waterfall: Waterfall,
    startHint?: BiomeId,
  ) {
    this.scene = scene;
    this.biomeLayer = biomeLayer;
    this.groundLayer = groundLayer;
    this.farHills = farHills;
    this.water = water;
    this.waterfall = waterfall;
    this.shuffleQueue();
    this.current =
      BIOMES.find((b) => b.id === startHint) ?? this.queue.shift()! ?? BIOMES[0];
    this.applyImmediate(this.current);
    this.fromFogD = this.current.fogDensity;
    this.toFogD = this.current.fogDensity;
    this.minDwell = BIOME.durationMin * 0.35; // allow early swap only after some pan
  }

  private shuffleQueue() {
    const list = [...BIOMES];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    if (this.current && list[0]?.id === this.current.id) {
      list.push(list.shift()!);
    }
    this.queue = list;
  }

  private applyImmediate(b: BiomeConfig) {
    const tex = makeBiomeTexture(b.id);
    this.biomeLayer.setTexture(tex);
    this.farHills.setTexture(makeBiomeTexture(b.id));
    this.groundLayer.setTexture(makeGroundTexture(b.id));
    this.water.setActive(false);
    this.waterfall.setActive(false);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = b.fogDensity;
      this.scene.fog.color.setHex(b.fogColor);
    }
    this.dwellTimer = 0;
  }

  get currentId() {
    return this.current.id;
  }

  forceBiome(id: BiomeId) {
    const b = BIOMES.find((x) => x.id === id) ?? BIOMES[0];
    this.current = b;
    this.nextBiome = null;
    this.transitioning = false;
    this.applyImmediate(b);
    this.fromFogD = b.fogDensity;
    this.toFogD = b.fogDensity;
  }

  update(dt: number) {
    this.dwellTimer += dt;

    if (this.transitioning && this.nextBiome) {
      this.transitionT += dt;
      const t = Math.min(1, this.transitionT / BIOME.crossfadeSeconds);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = THREE.MathUtils.lerp(this.fromFogD, this.toFogD, t);
        this.scene.fog.color.lerpColors(this.fromFogC, this.toFogC, t);
      }
      if (t >= 1) {
        this.transitioning = false;
        this.current = this.nextBiome;
        this.nextBiome = null;
        this.water.setActive(false);
        this.waterfall.setActive(false);
        this.dwellTimer = 0;
      }
      return;
    }

    // Advance when pan approaches the right edge of the current plate
    // (never wraps — so left/right image edges never meet on screen)
    if (
      this.dwellTimer >= this.minDwell &&
      (this.biomeLayer.isNearEnd || this.dwellTimer >= BIOME.durationMax)
    ) {
      this.beginTransition();
    }
  }

  private beginTransition() {
    if (this.queue.length === 0) this.shuffleQueue();
    let next = this.queue.shift()!;
    if (next.id === this.current.id && this.queue.length) {
      this.queue.push(next);
      next = this.queue.shift()!;
    }
    this.nextBiome = next;
    this.transitioning = true;
    this.transitionT = 0;

    this.fromFogD =
      this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog.density : FOG.density;
    this.toFogD = next.fogDensity;
    this.fromFogC =
      this.scene.fog instanceof THREE.FogExp2
        ? this.scene.fog.color.clone()
        : new THREE.Color(FOG.color);
    this.toFogC = new THREE.Color(next.fogColor);

    // Long soft dissolve into next panorama (starts at left of next plate)
    const nextTex = makeBiomeTexture(next.id);
    this.biomeLayer.crossfadeTo(nextTex, BIOME.crossfadeSeconds);
    this.farHills.crossfadeTo(makeBiomeTexture(next.id), BIOME.crossfadeSeconds);
    this.groundLayer.crossfadeTo(makeGroundTexture(next.id), BIOME.crossfadeSeconds);

    this.water.setActive(false);
    this.waterfall.setActive(false);
  }
}
