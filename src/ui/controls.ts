import type { Mixer } from '../audio/Mixer';
import { CHROME_IDLE_MS, STATIONS } from '../scene/constants';
import type { TrainRoute } from '../data/trains';

export class ControlsUI {
  root: HTMLElement;
  private hideTimer: number | null = null;
  private mixer: Mixer;
  private getStationName: () => string;
  private getStationIndex: () => number;
  private muteBtn: HTMLButtonElement | null = null;
  private onBack: (() => void) | null = null;
  private onStationChange: ((index: number) => void) | null = null;

  private stationDd: HTMLElement | null = null;
  private stationTrigger: HTMLButtonElement | null = null;
  private stationLabel: HTMLElement | null = null;
  private stationMenu: HTMLUListElement | null = null;
  private stationOpen = false;

  constructor(
    mixer: Mixer,
    getStationName: () => string,
    _getTrackTitle: () => string | null = () => null,
    getStationIndex: () => number = () => 0,
  ) {
    this.mixer = mixer;
    this.getStationName = getStationName;
    this.getStationIndex = getStationIndex;
    this.root = document.getElementById('chrome')!;
    this.wire();
    this.resetIdle();
    window.addEventListener('pointermove', () => this.resetIdle());
    window.addEventListener('touchstart', () => this.resetIdle(), { passive: true });
    this.refreshNowPlaying();
  }

  setBackHandler(fn: () => void) {
    this.onBack = fn;
  }

  setStationChangeHandler(fn: (index: number) => void) {
    this.onStationChange = fn;
  }

  setTrain(train: TrainRoute) {
    const el = document.getElementById('journey-label');
    if (el) {
      el.textContent = `${train.name}  ·  ${train.from} → ${train.to}`;
    }
    this.refreshNowPlaying();
  }

  refreshNowPlaying() {
    const station = this.getStationName();
    const idx = this.getStationIndex();
    if (this.stationLabel) {
      const s = STATIONS[idx];
      this.stationLabel.textContent = s?.short ?? station;
    }
    this.stationMenu?.querySelectorAll('.station-dd-item').forEach((el) => {
      const li = el as HTMLElement;
      li.classList.toggle('is-active', li.dataset.index === String(idx));
    });
    const about = document.getElementById('about-station');
    if (about) about.textContent = station;
  }

  private wire() {
    this.muteBtn = document.getElementById('btn-mute') as HTMLButtonElement;
    this.stationDd = document.getElementById('station-dd');
    this.stationTrigger = document.getElementById(
      'station-dd-trigger',
    ) as HTMLButtonElement | null;
    this.stationLabel = document.getElementById('station-dd-label');
    this.stationMenu = document.getElementById('station-dd-menu') as HTMLUListElement | null;

    this.buildStationMenu();
    this.wireStationDropdown();

    const vol = document.getElementById('vol-slider') as HTMLInputElement;
    const fsBtn = document.getElementById('btn-fs') as HTMLButtonElement;
    const aboutBtn = document.getElementById('btn-about') as HTMLButtonElement;
    const backBtn = document.getElementById('btn-back') as HTMLButtonElement | null;
    const aboutCard = document.getElementById('about-card') as HTMLElement;
    const closeAbout = document.getElementById('close-about') as HTMLButtonElement;

    vol.value = String(Math.round(this.mixer.getVolume() * 100));
    this.syncMuteIcon();
    this.paintVolumeTrack(vol);

    this.muteBtn.addEventListener('click', () => {
      this.mixer.toggleMute();
      this.syncMuteIcon();
    });

    vol.addEventListener('input', () => {
      const v = parseInt(vol.value, 10) / 100;
      this.mixer.setVolume(v);
      if (this.mixer.isMuted() && v > 0) this.mixer.setMuted(false);
      this.syncMuteIcon();
      this.paintVolumeTrack(vol);
    });

    fsBtn.addEventListener('click', async () => {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    });

    aboutBtn.addEventListener('click', () => {
      this.refreshNowPlaying();
      aboutCard.classList.toggle('open');
    });
    closeAbout?.addEventListener('click', () => aboutCard.classList.remove('open'));

    backBtn?.addEventListener('click', () => {
      aboutCard.classList.remove('open');
      this.setStationOpen(false);
      this.onBack?.();
    });

    window.setInterval(() => this.refreshNowPlaying(), 4000);
  }

  private buildStationMenu() {
    if (!this.stationMenu) return;
    this.stationMenu.innerHTML = '';
    STATIONS.forEach((s, i) => {
      const li = document.createElement('li');
      li.role = 'option';
      li.className = 'station-dd-item';
      li.dataset.index = String(i);
      li.innerHTML = `
        <span class="station-item-main">
          <span class="station-item-name">${s.short}</span>
          <span class="station-item-full">${s.name}</span>
        </span>
        <span class="station-item-check" aria-hidden="true"></span>
      `;
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pickStation(i);
      });
      this.stationMenu!.appendChild(li);
    });
  }

  private wireStationDropdown() {
    if (!this.stationDd || !this.stationTrigger || !this.stationMenu) return;

    // Portal menu so it never clips inside the pill
    document.body.appendChild(this.stationMenu);
    this.stationMenu.classList.add('station-dd-menu-portal');

    this.stationTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setStationOpen(!this.stationOpen);
      this.resetIdle();
    });

    document.addEventListener('click', (e) => {
      if (
        !this.stationDd?.contains(e.target as Node) &&
        !this.stationMenu?.contains(e.target as Node)
      ) {
        this.setStationOpen(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.setStationOpen(false);
    });

    window.addEventListener('resize', () => {
      if (this.stationOpen) this.positionStationMenu();
    });
  }

  private positionStationMenu() {
    if (!this.stationTrigger || !this.stationMenu) return;
    const rect = this.stationTrigger.getBoundingClientRect();
    const gap = 8;
    const width = Math.max(rect.width, 220);
    const left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12,
    );
    // Open upward so it sits above the control bar
    this.stationMenu.style.position = 'fixed';
    this.stationMenu.style.left = `${left}px`;
    this.stationMenu.style.width = `${width}px`;
    this.stationMenu.style.bottom = `${window.innerHeight - rect.top + gap}px`;
    this.stationMenu.style.top = 'auto';
    this.stationMenu.style.zIndex = '120';
  }

  private setStationOpen(open: boolean) {
    this.stationOpen = open;
    this.stationDd?.classList.toggle('is-open', open);
    this.stationTrigger?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (this.stationMenu) {
      this.stationMenu.hidden = !open;
      if (open) {
        this.positionStationMenu();
        this.root.classList.remove('dimmed');
      }
    }
  }

  private pickStation(index: number) {
    this.onStationChange?.(index);
    this.setStationOpen(false);
    this.refreshNowPlaying();
    this.resetIdle();
  }

  private paintVolumeTrack(vol: HTMLInputElement) {
    const pct = parseInt(vol.value, 10);
    vol.style.background = `linear-gradient(90deg, #fff ${pct}%, rgba(255,255,255,0.22) ${pct}%)`;
  }

  private syncMuteIcon() {
    if (!this.muteBtn) return;
    const muted = this.mixer.isMuted() || this.mixer.getVolume() === 0;
    this.muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    this.muteBtn.title = muted ? 'Unmute' : 'Mute';
    this.muteBtn.classList.toggle('is-muted', muted);
  }

  private resetIdle() {
    this.root.classList.remove('dimmed');
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => {
      // Don't dim while station menu is open
      if (this.stationOpen) return;
      this.root.classList.add('dimmed');
    }, CHROME_IDLE_MS);
  }

  showToast(msg: string | null) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    if (!msg) {
      toast.classList.remove('show');
      toast.textContent = '';
      return;
    }
    toast.textContent = msg;
    toast.classList.add('show');
  }
}
