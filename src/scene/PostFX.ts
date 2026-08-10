import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { POSTFX } from './constants';
import { makeGrainTexture } from './textures';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    grainMap: { value: null as THREE.Texture | null },
    grainAmp: { value: POSTFX.grainAmp },
    vignette: { value: POSTFX.vignetteStrength },
    caMax: { value: POSTFX.caMaxPx },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D grainMap;
    uniform float time;
    uniform vec2 resolution;
    uniform float grainAmp;
    uniform float vignette;
    uniform float caMax;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      vec2 fromCenter = uv - 0.5;
      float dist = length(fromCenter);
      vec2 dir = dist > 0.0 ? fromCenter / dist : vec2(0.0);
      float ca = caMax / resolution.x * dist * dist * 4.0;
      float r = texture2D(tDiffuse, uv + dir * ca).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * ca).b;
      vec3 color = vec3(r, g, b);

      // grain
      vec2 gUv = uv * resolution / 256.0 + vec2(time * 0.7, time * 1.1);
      float grain = texture2D(grainMap, gUv).r - 0.5;
      color += grain * grainAmp;

      // vignette
      float vig = smoothstep(0.9, 0.3, dist * (0.6 + vignette));
      color *= mix(1.0 - vignette * 0.8, 1.0, vig);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class PostFX {
  composer: EffectComposer;
  private bloom: UnrealBloomPass | null = null;
  private finalPass: ShaderPass;
  private useBloom: boolean;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    mobileTier = false,
  ) {
    this.useBloom = !mobileTier;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    if (this.useBloom) {
      this.bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        POSTFX.bloomStrength,
        POSTFX.bloomRadius,
        POSTFX.bloomThreshold,
      );
      this.composer.addPass(this.bloom);
    }

    this.finalPass = new ShaderPass(FinalShader);
    this.finalPass.uniforms.grainMap.value = makeGrainTexture();
    this.finalPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    this.composer.addPass(this.finalPass);
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.finalPass.uniforms.resolution.value.set(w, h);
    this.bloom?.setSize(w, h);
  }

  render(elapsed: number) {
    this.finalPass.uniforms.time.value = elapsed;
    this.composer.render();
  }
}
