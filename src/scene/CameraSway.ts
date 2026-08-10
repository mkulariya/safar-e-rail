import * as THREE from 'three';
import { SWAY } from './constants';

export type BumpCallback = () => void;

/**
 * Smooth AC coach feel only — no vertical bobbing / joint bumps.
 * (Tracks aren't speed-breakers.)
 */
export class CameraSway {
  private reduced: boolean;
  private onBump: BumpCallback | null = null;

  constructor() {
    this.reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  setBumpCallback(cb: BumpCallback) {
    this.onBump = cb;
  }

  update(camera: THREE.Camera, elapsed: number, dt: number) {
    if (this.reduced || SWAY.reducedMotionScale === 0) {
      camera.position.y = 0;
      camera.position.x = 0;
      camera.rotation.z = 0;
      camera.rotation.x = 0;
      camera.rotation.y = 0;
      document.documentElement.style.setProperty('--sway-x', '0px');
      document.documentElement.style.setProperty('--sway-y', '0px');
      void dt;
      return;
    }

    const t = elapsed;
    // Horizontal-only micro roll — no Y bounce
    const roll =
      SWAY.rollAmp1 * Math.sin(t * SWAY.rollFreq1) +
      SWAY.rollAmp2 * Math.sin(t * SWAY.rollFreq2 + SWAY.rollPhase2);

    camera.position.y = 0;
    camera.position.x = 0;
    camera.rotation.z = roll;
    camera.rotation.x = 0;
    camera.rotation.y = 0;

    document.documentElement.style.setProperty(
      '--sway-x',
      `${(Math.sin(t * 0.9) * 1.5).toFixed(2)}px`,
    );
    document.documentElement.style.setProperty('--sway-y', '0px');

    void this.onBump;
    void dt;
  }
}
