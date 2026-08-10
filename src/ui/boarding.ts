import { TRAINS, type TrainRoute } from '../data/trains';

export type BoardingResult = {
  train: TrainRoute;
};

type Handlers = {
  onReadyChange?: (ready: boolean, label: string) => void;
  onBoard: (result: BoardingResult) => void;
};

export class BoardingUI {
  root: HTMLElement;
  private selected: TrainRoute | null = null;
  private ready = false;
  private boardBtn: HTMLButtonElement;
  private statusEl: HTMLElement;
  private afterSelect: HTMLElement;
  private routeLine: HTMLElement;
  private handlers: Handlers;

  private dd: HTMLElement;
  private trigger: HTMLButtonElement;
  private label: HTMLElement;
  private menu: HTMLUListElement;
  private open = false;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
    this.root = document.getElementById('boarding')!;
    this.boardBtn = this.root.querySelector('#board-btn') as HTMLButtonElement;
    this.statusEl = this.root.querySelector('#board-status') as HTMLElement;
    this.afterSelect = this.root.querySelector('#after-select') as HTMLElement;
    this.routeLine = this.root.querySelector('#route-line') as HTMLElement;

    this.dd = this.root.querySelector('#train-dd') as HTMLElement;
    this.trigger = this.root.querySelector('#train-dd-trigger') as HTMLButtonElement;
    this.label = this.root.querySelector('#train-dd-label') as HTMLElement;
    this.menu = this.root.querySelector('#train-dd-menu') as HTMLUListElement;

    // Portal menu to body so it never clips inside boarding-center
    document.body.appendChild(this.menu);
    this.menu.classList.add('train-dd-menu-portal');

    this.buildMenu();
    this.wire();
  }

  private buildMenu() {
    this.menu.innerHTML = '';
    TRAINS.forEach((train) => {
      const li = document.createElement('li');
      li.role = 'option';
      li.tabIndex = -1;
      li.dataset.id = train.id;
      li.className = 'train-dd-item';
      li.innerHTML = `
        <span class="dd-name">${train.name}</span>
        <span class="dd-route">${train.from}<span class="dd-arrow">→</span>${train.to}</span>
      `;
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        this.pick(train);
      });
      this.menu.appendChild(li);
    });
  }

  private wire() {
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setOpen(!this.open);
    });

    document.addEventListener('click', (e) => {
      if (
        !this.dd.contains(e.target as Node) &&
        !this.menu.contains(e.target as Node)
      ) {
        this.setOpen(false);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') this.setOpen(false);
    });

    window.addEventListener('resize', () => {
      if (this.open) this.positionMenu();
    });
    window.addEventListener(
      'scroll',
      () => {
        if (this.open) this.positionMenu();
      },
      true,
    );

    this.boardBtn.addEventListener('click', () => {
      if (!this.selected || !this.ready) return;
      this.handlers.onBoard({ train: this.selected });
    });
  }

  private positionMenu() {
    const rect = this.trigger.getBoundingClientRect();
    const gap = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(rect.width, vw - 24);

    // Prefer opening downward; if not enough room, open upward
    const spaceBelow = vh - rect.bottom - gap - 16;
    const spaceAbove = rect.top - gap - 16;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxH = Math.max(160, Math.min(360, openUp ? spaceAbove : spaceBelow));

    this.menu.style.position = 'fixed';
    this.menu.style.left = `${Math.max(12, Math.min(rect.left, vw - width - 12))}px`;
    this.menu.style.width = `${width}px`;
    this.menu.style.maxHeight = `${maxH}px`;
    this.menu.style.zIndex = '100';
    this.menu.style.overflowY = 'auto';
    this.menu.style.right = 'auto';

    if (openUp) {
      this.menu.style.top = 'auto';
      this.menu.style.bottom = `${vh - rect.top + gap}px`;
    } else {
      this.menu.style.bottom = 'auto';
      this.menu.style.top = `${rect.bottom + gap}px`;
    }
  }

  private setOpen(open: boolean) {
    this.open = open;
    this.dd.classList.toggle('is-open', open);
    this.trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    this.menu.hidden = !open;
    if (open) {
      this.positionMenu();
      // Ensure first/active item is in view
      const active =
        this.menu.querySelector('.is-active') ?? this.menu.firstElementChild;
      (active as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
    }
  }

  private pick(train: TrainRoute) {
    this.selected = train;
    this.label.textContent = train.name;
    this.label.classList.add('is-selected');
    this.menu.querySelectorAll('.train-dd-item').forEach((el) => {
      el.classList.toggle('is-active', (el as HTMLElement).dataset.id === train.id);
    });
    this.routeLine.textContent = `${train.from}  →  ${train.to}   ·   via ${train.via.join(' · ')}`;
    this.afterSelect.classList.remove('hidden');
    this.setOpen(false);
    this.updateBoardButton();
  }

  setReady(ready: boolean, progress = 1) {
    this.ready = ready;
    const pct = Math.round(progress * 100);
    if (!ready) {
      this.statusEl.textContent = `Preparing journey… ${pct}%`;
      this.boardBtn.disabled = true;
      this.boardBtn.textContent = 'Please wait';
    } else {
      this.statusEl.textContent = '90s Bollywood · Non-stop';
      this.updateBoardButton();
    }
    this.handlers.onReadyChange?.(ready, this.boardBtn.textContent ?? '');
  }

  private updateBoardButton() {
    if (!this.ready) return;
    if (!this.selected) {
      this.boardBtn.disabled = true;
      this.boardBtn.textContent = 'Board';
    } else {
      this.boardBtn.disabled = false;
      this.boardBtn.textContent = 'Board the train';
    }
  }

  async fadeOut(ms = 1200) {
    this.setOpen(false);
    this.root.classList.add('fading');
    await new Promise((r) => setTimeout(r, ms));
    this.root.style.display = 'none';
    this.menu.hidden = true;
    document.body.classList.add('journey-active');
  }

  /** Return to the boarding / train-select screen. */
  showAgain() {
    this.setOpen(false);
    this.menu.hidden = true;
    this.root.classList.remove('fading');
    this.root.style.display = '';
    document.body.classList.remove('journey-active');
  }
}
