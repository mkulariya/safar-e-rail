import './style.css';
import { SceneManager } from './scene/SceneManager';
import { Mixer } from './audio/Mixer';
import { Radio } from './audio/Radio';
import { Ambience } from './audio/Ambience';
import { BoardingUI } from './ui/boarding';
import { ControlsUI } from './ui/controls';
import { DEPARTURE } from './scene/constants';
import { preloadAllTextures } from './scene/textures';

async function boot() {
  const canvas = document.getElementById('world') as HTMLCanvasElement;
  if (!canvas) throw new Error('canvas missing');

  const mixer = new Mixer();
  const radio = new Radio(mixer);
  const ambience = new Ambience(mixer);
  const scene = new SceneManager(canvas);

  const controls = new ControlsUI(
    mixer,
    () => radio.stationName,
    () => radio.currentTrack,
    () => radio.stationIndexPublic,
  );
  radio.setMetaHandler(() => controls.refreshNowPlaying());
  radio.setStatusHandler((msg) => {
    controls.showToast(msg);
    // Keep dropdown in sync when auto-failover advances station
    controls.refreshNowPlaying();
  });

  let boarded = false;
  let ambRaf = 0;

  const stopJourney = () => {
    boarded = false;
    if (ambRaf) cancelAnimationFrame(ambRaf);
    ambRaf = 0;
    scene.pause();
    radio.stop();
    ambience.stop();
    mixer.fadeMaster(0, 0.3);
    boarding.showAgain();
  };

  controls.setBackHandler(stopJourney);
  controls.setStationChangeHandler((index) => {
    void radio.selectStation(index).then(() => controls.refreshNowPlaying());
  });

  const boarding = new BoardingUI({
    onBoard: async ({ train }) => {
      if (boarded) return;
      boarded = true;

      await mixer.unlock();
      radio.el.volume = 0;
      await radio.play();
      await ambience.start();

      scene.setBumpCallback(() => ambience.playJointClack());
      scene.startDeparture(train.biomeHint);

      mixer.fadeMaster(mixer.getVolume(), DEPARTURE.audioFadeSeconds);
      controls.setTrain(train);
      controls.refreshNowPlaying();

      const start = performance.now();
      const ramp = () => {
        if (!boarded) return;
        const t = (performance.now() - start) / 1000;
        ambience.setSpeedMul(scene.getSpeedMul());
        ambience.update(1 / 60);
        if (t < DEPARTURE.rampSeconds + 1) requestAnimationFrame(ramp);
      };
      requestAnimationFrame(ramp);

      let last = performance.now();
      const ambLoop = () => {
        if (!boarded) return;
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        ambience.setSpeedMul(scene.getSpeedMul());
        ambience.update(dt);
        ambRaf = requestAnimationFrame(ambLoop);
      };
      ambRaf = requestAnimationFrame(ambLoop);

      await boarding.fadeOut(DEPARTURE.boardFadeSeconds * 1000);
    },
  });

  boarding.setReady(false, 0.05);
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  await preloadAllTextures((p) => {
    boarding.setReady(false, 0.05 + p * 0.7);
  });

  boarding.setReady(false, 0.8);
  scene.init('biome-01');
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  boarding.setReady(true, 1);
}

boot().catch((err) => {
  console.error(err);
  const status = document.getElementById('board-status');
  if (status) status.textContent = 'कुछ गड़बड़ है — पेज रीफ्रेश करें';
});
