import * as THREE from 'three';
import { fitPlaneToFrustum } from './frustum';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

/**
 * panMode: sample a sliding window of the texture (no wrap) so left/right
 * edges of the image never meet in-frame — eliminates vertical seam lines.
 */
const fragmentShader = /* glsl */ `
  uniform sampler2D mapA;
  uniform sampler2D mapB;
  uniform float uMix;
  uniform float opacity;
  uniform vec2 offsetA;
  uniform vec2 offsetB;
  uniform vec2 repeatA;
  uniform vec2 repeatB;
  uniform float panSpan;
  uniform bool panMode;
  uniform bool alphaTest;
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec2 uvA;
    vec2 uvB;
    if (panMode) {
      // Horizontal window into the panorama; clamp — never wrap
      uvA = vec2(clamp(offsetA.x + vUv.x * panSpan, 0.001, 0.999), vUv.y);
      uvB = vec2(clamp(offsetB.x + vUv.x * panSpan, 0.001, 0.999), vUv.y);
    } else {
      uvA = vUv * repeatA + offsetA;
      uvB = vUv * repeatB + offsetB;
    }
    vec4 a = texture2D(mapA, uvA);
    vec4 b = texture2D(mapB, uvB);
    vec4 color = mix(a, b, uMix);
    if (alphaTest && color.a < 0.08) discard;
    gl_FragColor = vec4(color.rgb, color.a * opacity);
    #include <fog_fragment>
  }
`;

export interface ParallaxLayerOptions {
  texture: THREE.Texture;
  z: number;
  speedRatio: number;
  camera: THREE.PerspectiveCamera;
  opacity?: number;
  alphaTest?: boolean;
  tiltX?: number;
  y?: number;
  tiles?: number;
  /** If true, pan a window across the texture without wrapping (no seam). */
  panMode?: boolean;
  /** Fraction of texture width visible across the plane (0.3–0.5 typical). */
  panSpan?: number;
}

export class ParallaxLayer {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  speedRatio: number;
  panMode: boolean;
  panSpan: number;
  private texA: THREE.Texture;
  private texB: THREE.Texture;
  private crossfading = false;
  private crossfadeT = 0;
  private crossfadeDur = 8;
  private pendingDispose: THREE.Texture | null = null;
  private disposeTimer: number | null = null;
  private tiles: number;
  private z: number;
  private tiltX: number;
  private y: number;
  /** Scroll progress 0 → maxOffset in pan mode */
  private scroll = 0;

  constructor(opts: ParallaxLayerOptions) {
    this.speedRatio = opts.speedRatio;
    this.texA = opts.texture;
    this.texB = opts.texture;
    this.tiles = opts.tiles ?? 1;
    this.z = opts.z;
    this.tiltX = opts.tiltX ?? 0;
    this.y = opts.y ?? 0;
    this.panMode = opts.panMode ?? false;
    this.panSpan = opts.panSpan ?? 0.42;

    if (this.panMode) {
      this.texA.wrapS = THREE.ClampToEdgeWrapping;
      this.texA.wrapT = THREE.ClampToEdgeWrapping;
    } else {
      this.texA.wrapS = THREE.RepeatWrapping;
      this.texA.repeat.set(this.tiles, 1);
    }

    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          mapA: { value: this.texA },
          mapB: { value: this.texB },
          uMix: { value: 0 },
          opacity: { value: opts.opacity ?? 1 },
          offsetA: { value: new THREE.Vector2(0, 0) },
          offsetB: { value: new THREE.Vector2(0, 0) },
          repeatA: { value: new THREE.Vector2(this.tiles, 1) },
          repeatB: { value: new THREE.Vector2(this.tiles, 1) },
          panSpan: { value: this.panSpan },
          panMode: { value: this.panMode },
          alphaTest: { value: opts.alphaTest ?? true },
        },
      ]),
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      fog: true,
      side: THREE.DoubleSide,
    });

    const { width, height } = fitPlaneToFrustum(opts.camera, opts.z, 1.25);
    const geo = new THREE.PlaneGeometry(width, height);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(0, this.y, this.z);
    if (this.tiltX) this.mesh.rotation.x = this.tiltX;
    this.mesh.frustumCulled = false;
  }

  /** Max scroll so the right edge of the window never past texture end. */
  get maxScroll() {
    return Math.max(0.02, 1 - this.panSpan - 0.02);
  }

  /** 0–1 progress through the current pan (pan mode). */
  get progress() {
    if (!this.panMode) return 0;
    return this.scroll / this.maxScroll;
  }

  get isNearEnd() {
    return this.panMode && this.progress >= 0.88;
  }

  get isAtEnd() {
    return this.panMode && this.progress >= 0.98;
  }

  update(dt: number, trainSpeed: number) {
    const d = trainSpeed * this.speedRatio * dt;
    const oa = this.material.uniforms.offsetA.value as THREE.Vector2;
    const ob = this.material.uniforms.offsetB.value as THREE.Vector2;

    if (this.panMode) {
      // Advance scroll; never wrap past max (seam never enters frame)
      this.scroll = Math.min(this.maxScroll, this.scroll + d);
      oa.x = this.scroll;
      if (!this.crossfading) {
        ob.x = this.scroll;
      } else {
        // During crossfade B keeps advancing from its own start
        ob.x = Math.min(this.maxScroll, ob.x + d);
      }
    } else {
      oa.x = (oa.x + d) % 1;
      ob.x = (ob.x + d) % 1;
    }

    if (this.crossfading) {
      this.crossfadeT += dt;
      const t = Math.min(1, this.crossfadeT / this.crossfadeDur);
      // Smoothstep for softer visual transition
      const s = t * t * (3 - 2 * t);
      this.material.uniforms.uMix.value = s;
      if (t >= 1) {
        this.crossfading = false;
        if (this.pendingDispose) {
          const old = this.pendingDispose;
          this.disposeTimer = window.setTimeout(() => {
            if (old !== this.texA && old !== this.texB) old.dispose();
          }, 10000);
        }
        this.texA = this.texB;
        this.material.uniforms.mapA.value = this.texA;
        const obDone = this.material.uniforms.offsetB.value as THREE.Vector2;
        this.scroll = this.panMode ? obDone.x : 0;
        oa.copy(obDone);
        this.material.uniforms.uMix.value = 0;
        this.pendingDispose = null;
      }
    }
  }

  crossfadeTo(nextTexture: THREE.Texture, seconds: number) {
    if (this.panMode) {
      nextTexture.wrapS = THREE.ClampToEdgeWrapping;
      nextTexture.wrapT = THREE.ClampToEdgeWrapping;
      nextTexture.repeat.set(1, 1);
    } else {
      nextTexture.wrapS = THREE.RepeatWrapping;
      nextTexture.repeat.set(this.tiles, 1);
    }
    this.pendingDispose = this.texA;
    this.texB = nextTexture;
    this.material.uniforms.mapB.value = this.texB;
    // New plate starts from the left (fresh pan)
    (this.material.uniforms.offsetB.value as THREE.Vector2).set(0, 0);
    this.crossfadeDur = seconds;
    this.crossfadeT = 0;
    this.crossfading = true;
  }

  setTexture(tex: THREE.Texture) {
    if (this.panMode) {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(1, 1);
    } else {
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.set(this.tiles, 1);
    }
    this.texA = tex;
    this.texB = tex;
    this.material.uniforms.mapA.value = tex;
    this.material.uniforms.mapB.value = tex;
    this.material.uniforms.uMix.value = 0;
    this.crossfading = false;
    this.scroll = 0;
    (this.material.uniforms.offsetA.value as THREE.Vector2).set(0, 0);
    (this.material.uniforms.offsetB.value as THREE.Vector2).set(0, 0);
  }

  refit(camera: THREE.PerspectiveCamera) {
    const { width, height } = fitPlaneToFrustum(camera, this.z, 1.25);
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(width, height);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    if (this.disposeTimer) clearTimeout(this.disposeTimer);
  }
}
