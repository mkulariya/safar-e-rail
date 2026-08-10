import { STATIONS } from '../scene/constants';
import type { Mixer } from './Mixer';

/**
 * Live radio with reconnect.
 * Note: first station often failed because `waiting` (buffering) was treated as a
 * hard failure after 8s — cold start often needs longer. Fixed below.
 */
export class Radio {
  el: HTMLAudioElement;
  private stationIndex = 0;
  private failCount = 0;
  private listFailCycles = 0;
  private waitingTimer: number | null = null;
  private retryTimer: number | null = null;
  private onStatus: ((msg: string | null) => void) | null = null;
  private onMeta: ((station: string, track: string | null) => void) | null = null;
  private started = false;
  private everPlayed = false;
  private mixer: Mixer;
  private trackTitle: string | null = null;
  private loadGen = 0;

  constructor(mixer: Mixer) {
    this.mixer = mixer;
    this.el = document.createElement('audio');
    this.el.id = 'radio';
    this.el.preload = 'none';
    this.el.setAttribute('playsinline', '');
    this.el.setAttribute('webkit-playsinline', '');
    // Help some CDNs that check accept headers
    this.el.setAttribute('type', 'audio/mpeg');
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    this.el.addEventListener('error', () => this.handleFail('error'));
    this.el.addEventListener('stalled', () => {
      // Only hard-fail stall after we've already played once and stall is long
      if (this.waitingTimer) clearTimeout(this.waitingTimer);
      this.waitingTimer = window.setTimeout(() => {
        if (!this.el.paused && this.el.readyState >= 2) return;
        this.handleFail('stalled');
      }, 15000);
    });
    this.el.addEventListener('ended', () => {
      // Icecast rarely ends; if it does, soft reload same station first
      this.handleFail('ended');
    });
    this.el.addEventListener('waiting', () => {
      // Buffering is normal on first connect — do NOT treat as failure quickly.
      // Only recover if stuck buffering for a long time after play has started.
      if (this.waitingTimer) clearTimeout(this.waitingTimer);
      this.waitingTimer = window.setTimeout(() => {
        if (this.el.readyState >= 3) return; // enough data
        if (!this.everPlayed) {
          // Still first connect — give more time, just reload same URL once
          this.reloadSame('cold-waiting');
          return;
        }
        this.handleFail('waiting');
      }, this.everPlayed ? 12000 : 25000);
    });
    this.el.addEventListener('playing', () => {
      if (this.waitingTimer) clearTimeout(this.waitingTimer);
      this.failCount = 0;
      this.listFailCycles = 0;
      this.everPlayed = true;
      this.onStatus?.(null);
      this.emitMeta();
    });
    this.el.addEventListener('canplay', () => {
      if (this.waitingTimer) clearTimeout(this.waitingTimer);
    });
    this.el.addEventListener('loadedmetadata', () => this.tryReadTitle());
  }

  setStatusHandler(fn: (msg: string | null) => void) {
    this.onStatus = fn;
  }

  setMetaHandler(fn: (station: string, track: string | null) => void) {
    this.onMeta = fn;
  }

  get stationName() {
    return STATIONS[this.stationIndex]?.name ?? 'Radio';
  }

  get stationIndexPublic() {
    return this.stationIndex;
  }

  get currentTrack() {
    return this.trackTitle;
  }

  async selectStation(index: number) {
    if (index < 0 || index >= STATIONS.length) return;
    if (index === this.stationIndex && this.started && !this.el.paused && this.everPlayed) {
      this.emitMeta();
      return;
    }
    this.stationIndex = index;
    this.failCount = 0;
    this.listFailCycles = 0;
    this.trackTitle = null;
    this.emitMeta();
    if (this.started) {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      if (this.waitingTimer) clearTimeout(this.waitingTimer);
      await this.loadAndPlay(false);
    }
  }

  private tryReadTitle() {
    const t = (this.el as HTMLAudioElement & { title?: string }).title;
    if (t && t.length > 1 && t !== this.stationName) {
      this.trackTitle = t;
      this.emitMeta();
    }
    try {
      const md = navigator.mediaSession?.metadata;
      if (md?.title) {
        this.trackTitle = md.title;
        this.emitMeta();
      }
    } catch {
      /* */
    }
  }

  private emitMeta() {
    this.onMeta?.(this.stationName, this.trackTitle);
  }

  async play() {
    this.started = true;
    this.mixer.attachRadioElement(this.el);
    await this.loadAndPlay(false);
  }

  stop() {
    this.started = false;
    this.everPlayed = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.waitingTimer) clearTimeout(this.waitingTimer);
    this.el.pause();
    this.el.removeAttribute('src');
    try {
      this.el.load();
    } catch {
      /* */
    }
    this.trackTitle = null;
  }

  private async loadAndPlay(cacheBust: boolean) {
    const station = STATIONS[this.stationIndex];
    if (!station) return;
    const gen = ++this.loadGen;
    this.trackTitle = null;
    this.emitMeta();

    // Prefer clean URL first — some Icecast mounts break with ?t= cache-bust
    let src = station.url;
    if (cacheBust) {
      src += station.url.includes('?') ? `&_=${Date.now()}` : `?_=${Date.now()}`;
    }

    try {
      this.el.pause();
    } catch {
      /* */
    }
    this.el.src = src;
    this.el.load();

    try {
      await this.el.play();
      if (gen !== this.loadGen) return;
      this.tryReadTitle();
    } catch {
      if (gen !== this.loadGen) return;
      // Retry once with cache-bust before counting as fail
      if (!cacheBust) {
        await this.loadAndPlay(true);
        return;
      }
      this.handleFail('play');
    }
  }

  private reloadSame(_reason: string) {
    if (!this.started) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => void this.loadAndPlay(true), 1500);
  }

  private handleFail(_reason: string) {
    if (!this.started) return;
    this.failCount++;

    // Soft: first 2 failures stay on same station (network blip)
    if (this.failCount < 3) {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = window.setTimeout(
        () => void this.loadAndPlay(this.failCount > 1),
        1500 + this.failCount * 500,
      );
      return;
    }

    // Hard: advance station
    this.failCount = 0;
    const prev = this.stationIndex;
    this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
    this.emitMeta();
    this.onStatus?.(`Switching station…`);

    if (this.stationIndex === 0 && prev !== 0) {
      this.listFailCycles++;
    }
    if (this.listFailCycles >= 2) {
      this.onStatus?.('सिग्नल नहीं मिल रहा… रुकिए');
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = window.setTimeout(() => {
        this.listFailCycles = 0;
        void this.loadAndPlay(true);
      }, 15000);
      return;
    }

    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => void this.loadAndPlay(false), 800);
  }
}
