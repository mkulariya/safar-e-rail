import * as THREE from 'three';
import { LAYER } from './constants';
import { makeWaterfallStrip, makeMistParticle } from './textures';

export class Waterfall {
  group: THREE.Group;
  private sheets: THREE.Mesh[] = [];
  private mist: THREE.Points;
  private mistLife: Float32Array;
  private mistPos: Float32Array;
  private active = false;
  private xPos = 30;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    const tex = makeWaterfallStrip();
    tex.wrapT = THREE.RepeatWrapping;

    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: tex.clone(),
        transparent: true,
        opacity: i === 0 ? 0.9 : 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      mat.map!.wrapT = THREE.RepeatWrapping;
      mat.map!.needsUpdate = true;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 28), mat);
      mesh.position.set(0, 2, 0);
      this.sheets.push(mesh);
      this.group.add(mesh);
    }

    const count = 28;
    this.mistLife = new Float32Array(count);
    this.mistPos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.respawnMist(i, true);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.mistPos, 3));
    const mistTex = makeMistParticle();
    const mat = new THREE.PointsMaterial({
      map: mistTex,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      size: 2.5,
      sizeAttenuation: true,
    });
    this.mist = new THREE.Points(geo, mat);
    this.group.add(this.mist);

    this.group.position.set(this.xPos, -2, LAYER.waterfall.z);
  }

  private respawnMist(i: number, randomLife = false) {
    this.mistPos[i * 3] = (Math.random() - 0.5) * 6;
    this.mistPos[i * 3 + 1] = -10 + Math.random() * 2;
    this.mistPos[i * 3 + 2] = Math.random() * 2;
    this.mistLife[i] = randomLife ? Math.random() * 3 : 0;
  }

  setActive(on: boolean) {
    this.active = on;
    this.group.visible = on;
    if (on) {
      this.xPos = 35 + Math.random() * 20;
      this.group.position.x = this.xPos;
    }
  }

  update(dt: number, trainSpeed: number) {
    if (!this.active) return;

    this.sheets.forEach((mesh, i) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat.map) {
        const speed = i === 0 ? 0.8 : 0.5;
        mat.map.offset.y = (mat.map.offset.y + speed * dt) % 1;
      }
    });

    this.xPos -= trainSpeed * LAYER.waterfall.speedRatio * 55 * dt;
    this.group.position.x = this.xPos;
    if (this.xPos < -45) {
      this.xPos = 40 + Math.random() * 30;
    }

    for (let i = 0; i < this.mistLife.length; i++) {
      this.mistLife[i] += dt;
      this.mistPos[i * 3] += 0.8 * dt;
      this.mistPos[i * 3 + 1] += 2.5 * dt;
      if (this.mistLife[i] > 3) this.respawnMist(i);
    }
    (this.mist.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
