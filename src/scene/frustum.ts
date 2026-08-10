import * as THREE from 'three';

/** Size a plane at depth z so it overfills the frustum by overscan (≥1). */
export function fitPlaneToFrustum(
  camera: THREE.PerspectiveCamera,
  z: number,
  overscan = 1.2,
): { width: number; height: number } {
  const dist = Math.abs(z - camera.position.z);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const height = 2 * Math.tan(vFov / 2) * dist * overscan;
  const width = height * camera.aspect * overscan;
  return { width, height };
}
