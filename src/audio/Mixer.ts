import { AUDIO } from '../scene/constants';

const STORAGE_VOL = 'safar-volume';
const STORAGE_MUTE = 'safar-muted';

export class Mixer {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  radioGain: GainNode | null = null;
  clatterGain: GainNode | null = null;
  accentGain: GainNode | null = null;
  /** When MediaElementSource fails (CORS), radio plays outside the graph. */
  externalRadio = false;
  private volume: number = AUDIO.masterDefault;
  private muted = false;
  private radioEl: HTMLAudioElement | null = null;

  constructor() {
    try {
      const v = localStorage.getItem(STORAGE_VOL);
      if (v != null) this.volume = Math.min(1, Math.max(0, parseFloat(v)));
      const m = localStorage.getItem(STORAGE_MUTE);
      if (m != null) this.muted = m === '1';
    } catch {
      /* ignore */
    }
  }

  /** Must be called inside a user gesture. */
  async unlock(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.radioGain = this.ctx.createGain();
      this.clatterGain = this.ctx.createGain();
      this.accentGain = this.ctx.createGain();

      this.radioGain.connect(this.masterGain);
      this.clatterGain.connect(this.masterGain);
      this.accentGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.radioGain.gain.value = AUDIO.radioGain;
      this.clatterGain.gain.value = AUDIO.clatterGain;
      this.accentGain.gain.value = AUDIO.accentGain;
      this.masterGain.gain.value = 0; // fade in later
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.applyVolume(true);
    return this.ctx;
  }

  attachRadioElement(el: HTMLAudioElement) {
    this.radioEl = el;
    // Zeno and most free streams lack CORS → MediaElementSource would silence output.
    // Play radio outside the Web Audio graph; ambience stays on masterGain.
    this.externalRadio = true;
    el.volume = this.muted ? 0 : this.volume * AUDIO.radioGain;
  }

  /** Soft ramp master 0→target over seconds (also ramps external radio). */
  fadeMaster(to: number, seconds: number) {
    const target = this.muted ? 0 : to;
    if (this.ctx && this.masterGain) {
      const g = this.masterGain.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(target, now + seconds);
    }
    if (this.externalRadio && this.radioEl) {
      const el = this.radioEl;
      const from = el.volume;
      const toVol = this.muted ? 0 : target * AUDIO.radioGain;
      const t0 = performance.now();
      const step = () => {
        const u = Math.min(1, (performance.now() - t0) / (seconds * 1000));
        el.volume = from + (toVol - from) * u;
        if (u < 1) requestAnimationFrame(step);
      };
      el.volume = from;
      requestAnimationFrame(step);
    }
  }

  setVolume(v: number) {
    this.volume = Math.min(1, Math.max(0, v));
    try {
      localStorage.setItem(STORAGE_VOL, String(this.volume));
    } catch {
      /* */
    }
    this.applyVolume();
  }

  getVolume() {
    return this.volume;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(STORAGE_MUTE, m ? '1' : '0');
    } catch {
      /* */
    }
    this.applyVolume();
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private applyVolume(instant = false) {
    const target = this.muted ? 0 : this.volume;
    if (this.ctx && this.masterGain) {
      const g = this.masterGain.gain;
      const now = this.ctx.currentTime;
      if (instant) {
        g.setValueAtTime(target, now);
      } else {
        g.setTargetAtTime(target, now, AUDIO.gainTau);
      }
    }
    if (this.externalRadio && this.radioEl) {
      this.radioEl.volume = this.muted ? 0 : this.volume * AUDIO.radioGain;
    }
  }
}
