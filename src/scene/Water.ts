import * as THREE from 'three';
import { LAYER } from './constants';
import { fitPlaneToFrustum } from './frustum';
import { makeWaterTexture, makeWaterNormal } from './textures';

const waterVert = /* glsl */ `
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

const waterFrag = /* glsl */ `
  uniform sampler2D map;
  uniform sampler2D normalMap;
  uniform float time;
  uniform vec2 scroll;
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec2 uv = vUv * vec2(3.0, 1.0) + scroll;
    vec2 n1 = texture2D(normalMap, uv * 1.5 + vec2(time * 0.03, time * 0.02)).rg - 0.5;
    vec2 n2 = texture2D(normalMap, uv * 2.7 - vec2(time * 0.025, time * -0.015)).rg - 0.5;
    vec2 distort = (n1 + n2) * 0.04;
    vec4 color = texture2D(map, uv + distort);
    gl_FragColor = vec4(color.rgb, 0.85);
    #include <fog_fragment>
  }
`;

export class Water {
  group: THREE.Group;
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private sparkles: THREE.Points;
  private sparkleVel: Float32Array;
  private visible = false;
  constructor(_camera: THREE.PerspectiveCamera) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const map = makeWaterTexture();
    const normalMap = makeWaterNormal();

    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          map: { value: map },
          normalMap: { value: normalMap },
          time: { value: 0 },
          scroll: { value: new THREE.Vector2(0, 0) },
        },
      ]),
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      transparent: true,
      depthWrite: false,
      fog: true,
    });

    const { width } = fitPlaneToFrustum(_camera, LAYER.water.z, 1.3);
    const geo = new THREE.PlaneGeometry(width, 12);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.rotation.x = -Math.PI * 0.42;
    this.mesh.position.set(0, -6, LAYER.water.z);
    this.group.add(this.mesh);

    // Sparkles
    const count = 10;
    const positions = new Float32Array(count * 3);
    this.sparkleVel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * width * 0.8;
      positions[i * 3 + 1] = -5 + Math.random() * 2;
      positions[i * 3 + 2] = LAYER.water.z + Math.random();
      this.sparkleVel[i] = 0.5 + Math.random();
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sMat = new THREE.PointsMaterial({
      color: 0xfff5d6,
      size: 0.35,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.sparkles = new THREE.Points(sGeo, sMat);
    this.group.add(this.sparkles);
  }

  setActive(on: boolean) {
    this.visible = on;
    this.group.visible = on;
  }

  update(dt: number, trainSpeed: number, elapsed: number) {
    if (!this.visible) return;
    this.material.uniforms.time.value = elapsed;
    const scroll = this.material.uniforms.scroll.value as THREE.Vector2;
    scroll.x = (scroll.x + trainSpeed * LAYER.water.speedRatio * dt) % 1;

    const pos = this.sparkles.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const halfW = 40;
    for (let i = 0; i < this.sparkleVel.length; i++) {
      arr[i * 3] -= trainSpeed * LAYER.water.speedRatio * 40 * dt;
      // twinkle via material opacity global + per-point y wiggle
      arr[i * 3 + 1] = -5 + Math.sin(elapsed * 4 + i) * 0.3;
      if (arr[i * 3] < -halfW) {
        arr[i * 3] = halfW + Math.random() * 10;
      }
    }
    pos.needsUpdate = true;
    (this.sparkles.material as THREE.PointsMaterial).opacity =
      0.4 + 0.4 * Math.abs(Math.sin(elapsed * 3));
  }

  refit(camera: THREE.PerspectiveCamera) {
    const { width } = fitPlaneToFrustum(camera, LAYER.water.z, 1.3);
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(width, 12);
  }
}
