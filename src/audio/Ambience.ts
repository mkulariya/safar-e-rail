import { AUDIO } from '../scene/constants';
import type { Mixer } from './Mixer';

/**
 * AC-coach train ambience (procedural Web Audio).
 * Layers: deep coach rumble + AC air hiss + soft dual-beat rail rhythm
 * + sparse distant horn / crossing bell. Kept well under music level.
 */
export class Ambience {
  private sources: AudioBufferSourceNode[] = [];
  private filters: AudioNode[] = [];
  private rate: number = AUDIO.clatterPlaybackStart;
  private nextEventAt = 0;
  private started = false;
  private elapsed = 0;
  private mixer: Mixer;

  constructor(mixer: Mixer) {
    this.mixer = mixer;
  }

  stop() {
    this.sources.forEach((n) => {
      try {
        n.stop();
        n.disconnect();
      } catch {
        /* */
      }
    });
    this.filters.forEach((n) => {
      try {
        n.disconnect();
      } catch {
        /* */
      }
    });
    this.sources = [];
    this.filters = [];
    this.started = false;
    this.elapsed = 0;
  }

  async start() {
    const ctx = this.mixer.ctx;
    if (!ctx || !this.mixer.clatterGain || !this.mixer.accentGain) return;
    if (this.started) return;

    const master = this.mixer.clatterGain;

    // 1) Deep coach body rumble (very low)
    const rumble = this.makeCoachRumble(ctx, 12);
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = rumble;
    rumbleSrc.loop = true;
    rumbleSrc.playbackRate.value = this.rate;
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = 'lowpass';
    rumbleLp.frequency.value = 120;
    rumbleLp.Q.value = 0.7;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.55;
    rumbleSrc.connect(rumbleLp);
    rumbleLp.connect(rumbleGain);
    rumbleGain.connect(master);

    // 2) Soft AC / HVAC air hiss
    const hiss = this.makeAirHiss(ctx, 6);
    const hissSrc = ctx.createBufferSource();
    hissSrc.buffer = hiss;
    hissSrc.loop = true;
    const hissHp = ctx.createBiquadFilter();
    hissHp.type = 'bandpass';
    hissHp.frequency.value = 1800;
    hissHp.Q.value = 0.5;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.12;
    hissSrc.connect(hissHp);
    hissHp.connect(hissGain);
    hissGain.connect(master);

    // 3) Rhythmic rail joints — soft da-dum (not harsh clicks)
    const rails = this.makeRailRhythm(ctx, 8);
    const railSrc = ctx.createBufferSource();
    railSrc.buffer = rails;
    railSrc.loop = true;
    railSrc.playbackRate.value = this.rate;
    const railBp = ctx.createBiquadFilter();
    railBp.type = 'bandpass';
    railBp.frequency.value = 180;
    railBp.Q.value = 0.9;
    const railGain = ctx.createGain();
    railGain.gain.value = 0.28;
    railSrc.connect(railBp);
    railBp.connect(railGain);
    railGain.connect(master);

    // 4) Mid coach resonance (wooden/metal cabin tone)
    const cabin = this.makeCabinTone(ctx, 10);
    const cabinSrc = ctx.createBufferSource();
    cabinSrc.buffer = cabin;
    cabinSrc.loop = true;
    cabinSrc.playbackRate.value = this.rate * 0.98;
    const cabinLp = ctx.createBiquadFilter();
    cabinLp.type = 'lowpass';
    cabinLp.frequency.value = 350;
    const cabinGain = ctx.createGain();
    cabinGain.gain.value = 0.18;
    cabinSrc.connect(cabinLp);
    cabinLp.connect(cabinGain);
    cabinGain.connect(master);

    rumbleSrc.start();
    hissSrc.start();
    railSrc.start();
    cabinSrc.start();

    this.sources = [rumbleSrc, hissSrc, railSrc, cabinSrc];
    this.filters = [rumbleLp, rumbleGain, hissHp, hissGain, railBp, railGain, cabinLp, cabinGain];
    this.started = true;
    this.nextEventAt =
      45 + Math.random() * (AUDIO.eventIntervalMax - AUDIO.eventIntervalMin);
  }

  setSpeedMul(mul: number) {
    const t = (mul - 0.15) / 0.85;
    this.rate =
      AUDIO.clatterPlaybackStart +
      (AUDIO.clatterPlaybackFull - AUDIO.clatterPlaybackStart) *
        Math.min(1, Math.max(0, t));
    const ctx = this.mixer.ctx;
    if (!ctx) return;
    this.sources.forEach((n, i) => {
      // Keep air hiss rate stable; scale mechanical layers
      const r = i === 1 ? 1.0 : this.rate;
      n.playbackRate.setTargetAtTime(r, ctx.currentTime, 0.15);
    });
  }

  /** Soft accent (no harsh slap) — used if something still triggers bumps. */
  playJointClack() {
    const ctx = this.mixer.ctx;
    if (!ctx || !this.mixer.accentGain || !this.started) return;
    const now = ctx.currentTime;
    // Soft double thump: bogie da-dum
    this.softThump(ctx, now, 0.9);
    this.softThump(ctx, now + 0.07, 0.65);
  }

  update(dt: number) {
    if (!this.started) return;
    this.elapsed += dt;
    if (this.elapsed >= this.nextEventAt) {
      this.fireRandomEvent();
      this.nextEventAt =
        this.elapsed +
        AUDIO.eventIntervalMin +
        Math.random() * (AUDIO.eventIntervalMax - AUDIO.eventIntervalMin);
    }
  }

  private fireRandomEvent() {
    const ctx = this.mixer.ctx;
    if (!ctx || !this.mixer.accentGain) return;
    // Mostly horns; rare crossing bell
    if (Math.random() > 0.28) {
      this.playDistantHorn(ctx);
    } else {
      this.playCrossingBell(ctx);
    }
  }

  private softThump(ctx: AudioContext, t: number, amp: number) {
    const noise = ctx.createBufferSource();
    noise.buffer = this.makeTransient(ctx, 0.08);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14 * amp, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    noise.connect(lp);
    lp.connect(g);
    g.connect(this.mixer.accentGain!);
    noise.start(t);
    noise.stop(t + 0.1);
  }

  /** Distant Indian loco horn — filtered dual tones, not a raw buzzer. */
  private playDistantHorn(ctx: AudioContext) {
    const now = ctx.currentTime;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.6;
    // Distant: high-cut + low level + slight reverb-ish delay
    const delay = ctx.createDelay(0.4);
    delay.delayTime.value = 0.08;
    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.25;

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.09, now + 0.25);
    g.gain.setValueAtTime(0.08, now + 0.9);
    g.gain.linearRampToValueAtTime(0.07, now + 1.4);
    g.gain.linearRampToValueAtTime(0, now + 2.4);

    // Two-tone horn (common on Indian locos): ~370 / ~310 or similar
    const f1 = Math.random() > 0.5 ? 370 : 340;
    const f2 = f1 * 0.82;
    for (const [f, det] of [
      [f1, 0],
      [f2, 0.02],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const slight = ctx.createOscillator();
      slight.type = 'sine';
      slight.frequency.value = 2.5 + Math.random();
      const slightG = ctx.createGain();
      slightG.gain.value = 3;
      slight.connect(slightG);
      slightG.connect(o.frequency);
      o.connect(lp);
      o.start(now + det);
      o.stop(now + 2.5);
      slight.start(now + det);
      slight.stop(now + 2.5);
    }

    lp.connect(g);
    g.connect(this.mixer.accentGain!);
    g.connect(delay);
    delay.connect(delayGain);
    delayGain.connect(this.mixer.accentGain!);
  }

  private playCrossingBell(ctx: AudioContext) {
    const now = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(-0.65, now);
    panner.pan.linearRampToValueAtTime(0.65, now + 5);
    const outG = ctx.createGain();
    outG.gain.value = 0.55;
    panner.connect(outG);
    outG.connect(this.mixer.accentGain!);

    // Softer metallic ding, not piercing
    for (let i = 0; i < 10; i++) {
      const t = now + i * 0.38;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 880 + (i % 2) * 40;
      bp.Q.value = 8;
      osc.type = 'triangle';
      osc.frequency.value = 920 + (i % 3) * 15;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(bp);
      bp.connect(g);
      g.connect(panner);
      osc.start(t);
      osc.stop(t + 0.4);
    }
  }

  private makeCoachRumble(ctx: AudioContext, seconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      // multi-stage brown noise (very low)
      b0 = (b0 + 0.015 * white) / 1.015;
      b1 = (b1 + 0.04 * b0) / 1.04;
      b2 = (b2 + 0.08 * b1) / 1.08;
      const t = i / rate;
      // slow cabin sway modulation
      const mod = 1 + 0.08 * Math.sin(t * 0.7) + 0.04 * Math.sin(t * 1.9 + 0.5);
      // very soft sub pulse ~ bogie mass
      const sub = 0.06 * Math.sin(t * Math.PI * 2 * 2.1);
      const s = (b2 * 4.5 + sub) * mod * 0.4;
      // tiny stereo width
      L[i] = s * (1 + 0.03 * Math.sin(t * 0.3));
      R[i] = s * (1 - 0.03 * Math.sin(t * 0.3));
    }
    this.crossfadeLoop(L, rate);
    this.crossfadeLoop(R, rate);
    return buf;
  }

  private makeAirHiss(ctx: AudioContext, seconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      // filtered-ish pink-ish air
      d[i] = (Math.random() * 2 - 1) * 0.08;
    }
    // simple one-pole highpass-ish by differentiating lightly
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const x = d[i];
      d[i] = (x - prev) * 0.6 + x * 0.15;
      prev = x;
    }
    this.crossfadeLoop(d, rate);
    return buf;
  }

  private makeRailRhythm(ctx: AudioContext, seconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    // ~ rail joint period at ~100 km/h with ~12m bogie spacing ≈ 0.43s
    const period = Math.floor(rate * 0.44);
    const half = Math.floor(period * 0.12);
    for (let i = 0; i < len; i++) {
      const phase = i % period;
      // first beat (stronger)
      if (phase < half) {
        const env = Math.pow(1 - phase / half, 2.2);
        // filtered noise thump
        d[i] += (Math.random() * 2 - 1) * env * 0.22;
        d[i] += Math.sin((phase / rate) * Math.PI * 2 * 90) * env * 0.08;
      }
      // second beat (softer, da-dum)
      const phase2 = (i + Math.floor(period * 0.14)) % period;
      if (phase2 < half * 0.7) {
        const env = Math.pow(1 - phase2 / (half * 0.7), 2.5);
        d[i] += (Math.random() * 2 - 1) * env * 0.12;
      }
    }
    this.crossfadeLoop(d, rate);
    return buf;
  }

  private makeCabinTone(ctx: AudioContext, seconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b = (b + 0.03 * white) / 1.03;
      const t = i / rate;
      const tone =
        0.015 * Math.sin(t * Math.PI * 2 * 55) +
        0.01 * Math.sin(t * Math.PI * 2 * 110 + 0.4);
      d[i] = b * 0.9 + tone;
    }
    this.crossfadeLoop(d, rate);
    return buf;
  }

  private makeTransient(ctx: AudioContext, seconds: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 3);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    return buf;
  }

  private crossfadeLoop(d: Float32Array, sampleRate: number) {
    const fade = Math.floor(sampleRate * 0.08);
    const len = d.length;
    for (let i = 0; i < fade; i++) {
      const w = i / fade;
      d[i] = d[i] * w + d[len - fade + i] * (1 - w);
    }
  }
}
