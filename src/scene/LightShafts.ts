import * as THREE from 'three';
import { LAYER } from './constants';

export class LightShafts {
  group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private baseOpacity = [0.05, 0.04, 0.055];

  constructor() {
    this.group = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.ConeGeometry(3 + i, 40, 8, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffe6b0,
        transparent: true,
        opacity: this.baseOpacity[i],
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-8 + i * 10, 12, LAYER.lightShafts.z);
      mesh.rotation.z = Math.PI + 0.35 + i * 0.08;
      mesh.rotation.x = 0.2;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
  }

  update(dt: number, trainSpeed: number, elapsed: number) {
    this.meshes.forEach((mesh, i) => {
      mesh.position.x += trainSpeed * LAYER.lightShafts.speedRatio * 10 * dt;
      if (mesh.position.x > 25) mesh.position.x = -25;
      const pulse = 0.03 + 0.025 * (0.5 + 0.5 * Math.sin(elapsed * 0.1 + i * 2));
      (mesh.material as THREE.MeshBasicMaterial).opacity = pulse;
    });
  }
}
