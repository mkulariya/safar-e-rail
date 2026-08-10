import * as THREE from 'three';
import {
  CAMERA,
  DEPARTURE,
  DT_CLAMP_MS,
  FOG,
  LAYER,
  RENDERER,
  RESIZE_DEBOUNCE_MS,
  TRAIN_SPEED,
} from './constants';
import { ParallaxLayer } from './ParallaxLayer';
import { BiomeDirector, type BiomeId } from './BiomeDirector';
import { CameraSway } from './CameraSway';
import { Water } from './Water';
import { Waterfall } from './Waterfall';
import { LightShafts } from './LightShafts';
import { PostFX } from './PostFX';
import {
  makeSkyTexture,
  makeBiomeTexture,
  makeNearGrassTexture,
} from './textures';

/**
 * Single coherent landscape through the window:
 * - full-frame sky/atmosphere plate (slow)
 * - full-frame nature hero plate (main view — one image top-to-bottom)
 * - soft near grass blur only
 * No poles, no mismatched multi-band collage.
 */
export class SceneManager {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock(false);
  private layers: ParallaxLayer[] = [];
  private biomeLayer!: ParallaxLayer;
  private groundLayer!: ParallaxLayer;
  private farHills!: ParallaxLayer;
  private water!: Water;
  private waterfall!: Waterfall;
  private lightShafts!: LightShafts;
  private director!: BiomeDirector;
  private sway = new CameraSway();
  private postfx!: PostFX;
  private running = false;
  private speedMul: number = DEPARTURE.startSpeedMul;
  private departureActive = false;
  private departureT = 0;
  private resizeTimer: number | null = null;
  private onBump: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const host = (canvas.parentElement ?? canvas) as HTMLElement;
    const w = Math.max(1, host.clientWidth || window.innerWidth);
    const h = Math.max(1, host.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        isMobile ? RENDERER.mobilePixelRatioCap : RENDERER.desktopPixelRatioCap,
      ),
    );
    // false = don't override CSS; glass box sets display size
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = RENDERER.exposure;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(FOG.color, FOG.density);
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      CAMERA.fov,
      w / h,
      CAMERA.near,
      CAMERA.far,
    );
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1);
  }

  init(startBiome?: BiomeId) {
    const biomeId = startBiome ?? 'biome-01';

    // Soft distant atmosphere (same golden-hour family as biomes)
    const sky = new ParallaxLayer({
      texture: makeSkyTexture(),
      z: LAYER.sky.z,
      speedRatio: LAYER.sky.speedRatio,
      camera: this.camera,
      alphaTest: false,
      opacity: 1,
      tiles: 1,
      y: 0,
    });
    this.layers.push(sky);
    this.scene.add(sky.mesh);

    // Placeholder far/mid slots kept for BiomeDirector API — use same hero art, slower
    // Kept for BiomeDirector API; hidden — one hero image only (no stacked mismatch)
    this.farHills = new ParallaxLayer({
      texture: makeBiomeTexture(biomeId),
      z: LAYER.farHills.z,
      speedRatio: LAYER.farHills.speedRatio,
      camera: this.camera,
      alphaTest: false,
      opacity: 0,
      tiles: 1,
      y: 2,
    });
    this.farHills.mesh.visible = false;
    this.layers.push(this.farHills);
    this.scene.add(this.farHills.mesh);

    // HERO — pan across panorama without wrapping (no vertical seam lines)
    this.biomeLayer = new ParallaxLayer({
      texture: makeBiomeTexture(biomeId),
      z: LAYER.biome.z,
      speedRatio: LAYER.biome.speedRatio,
      camera: this.camera,
      alphaTest: false,
      opacity: 1,
      tiles: 1,
      y: 0,
      panMode: true,
      // ~42% of plate width visible → ~60s pan at TRAIN_SPEED * speedRatio
      panSpan: 0.42,
    });
    this.layers.push(this.biomeLayer);
    this.scene.add(this.biomeLayer.mesh);

    // Ground slot reused as subtle second copy of same biome (depth only), not a different texture family
    this.groundLayer = new ParallaxLayer({
      texture: makeBiomeTexture(biomeId),
      z: LAYER.ground.z,
      speedRatio: LAYER.ground.speedRatio,
      camera: this.camera,
      alphaTest: false,
      opacity: 0,
      tiles: 1,
      y: -20,
    });
    // Keep in scene graph for director crossfade dispose path but invisible
    this.groundLayer.mesh.visible = false;
    this.layers.push(this.groundLayer);
    this.scene.add(this.groundLayer.mesh);

    // Soft speed blur only — no poles
    const grass = new ParallaxLayer({
      texture: makeNearGrassTexture(),
      z: LAYER.nearGrass.z,
      speedRatio: LAYER.nearGrass.speedRatio,
      camera: this.camera,
      opacity: 0.35,
      alphaTest: false,
      y: -10,
      tiles: 3,
    });
    this.layers.push(grass);
    this.scene.add(grass.mesh);

    // Water/waterfall kept for API but never shown — painted into biome art
    this.water = new Water(this.camera);
    this.water.setActive(false);
    this.scene.add(this.water.group);

    this.waterfall = new Waterfall();
    this.waterfall.setActive(false);
    this.scene.add(this.waterfall.group);

    this.lightShafts = new LightShafts();
    this.scene.add(this.lightShafts.group);

    this.director = new BiomeDirector(
      this.scene,
      this.biomeLayer,
      this.groundLayer,
      this.farHills,
      this.water,
      this.waterfall,
      biomeId,
    );

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    this.postfx = new PostFX(this.renderer, this.scene, this.camera, isMobile);

    this.sway.setBumpCallback(() => this.onBump?.());

    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setBumpCallback(cb: () => void) {
    this.onBump = cb;
  }

  startDeparture(startBiome?: BiomeId) {
    if (startBiome) this.director.forceBiome(startBiome);
    this.departureActive = true;
    this.departureT = 0;
    this.speedMul = DEPARTURE.startSpeedMul;
    this.clock.start();
    this.running = true;
    this.loop();
  }

  getSpeedMul() {
    return this.speedMul;
  }

  pause() {
    this.running = false;
    this.departureActive = false;
    this.clock.stop();
  }

  private onResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      const host = (this.renderer.domElement.parentElement ??
        this.renderer.domElement) as HTMLElement;
      const w = Math.max(1, host.clientWidth || window.innerWidth);
      const h = Math.max(1, host.clientHeight || window.innerHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      this.postfx.setSize(w, h);
      this.layers.forEach((l) => l.refit(this.camera));
      this.water.refit(this.camera);
    }, RESIZE_DEBOUNCE_MS);
  };

  private onVisibility = () => {
    if (document.hidden) {
      this.running = false;
    } else if (!this.running && this.clock.running) {
      this.clock.getDelta();
      this.running = true;
      this.loop();
    }
  };

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    let dt = this.clock.getDelta();
    dt = Math.min(dt, DT_CLAMP_MS / 1000);
    const elapsed = this.clock.elapsedTime;

    if (this.departureActive) {
      this.departureT += dt;
      const t = Math.min(1, this.departureT / DEPARTURE.rampSeconds);
      const s = t * t * (3 - 2 * t);
      this.speedMul = DEPARTURE.startSpeedMul + (1 - DEPARTURE.startSpeedMul) * s;
      if (t >= 1) this.departureActive = false;
    }

    const trainSpeed = TRAIN_SPEED * this.speedMul;

    this.sway.update(this.camera, elapsed, dt);
    this.layers.forEach((l) => l.update(dt, trainSpeed));
    this.water.update(dt, trainSpeed, elapsed);
    this.waterfall.update(dt, trainSpeed);
    this.lightShafts.update(dt, trainSpeed, elapsed);
    this.director.update(dt);

    this.postfx.render(elapsed);
  };

  dispose() {
    this.running = false;
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.layers.forEach((l) => l.dispose());
    this.renderer.dispose();
  }
}
