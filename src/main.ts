import {
  Scene, PerspectiveCamera, WebGLRenderer, SRGBColorSpace,
  ACESFilmicToneMapping, PCFSoftShadowMap, Color, FogExp2
} from 'three';
import { createControls } from './controls';
import { buildGallery } from './gallery';
import type { ArtworkMeta } from './types';

async function fetchMetadata(): Promise<ArtworkMeta[]> {
  const url = `${import.meta.env.BASE_URL}metadata.json`;
  const r = await fetch(url);
  return r.ok ? r.json() : [];
}

// ── Day / Night palette definitions ──────────────────────────────────────────
const DAY = {
  bg:         new Color(0xf1f2f5),
  fogDensity: 0.008,
  ambInt:     0.65,
  hemiInt:    0.85,
  sunInt:     0.75,
  nightInt:   0.0,
  statueInt:  0.0,   // statue spots off in daylight
  washInt:    0.0,   // picture-wash room lights off in daylight
  exposure:   2.0,
};
const NIGHT = {
  bg:         new Color(0x0a0b10),
  fogDensity: 0.018,
  ambInt:     0.12,
  hemiInt:    0.10,
  sunInt:     0.05,
  nightInt:   1.2,
  statueInt:  2.2,   // cool blue-white spots highlight each statue at night
  washInt:    1.4,   // warm wash illuminates paintings at night
  exposure:   1.1,
};

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ── Day/Night toggle button (fully inline styles) ─────────────────────────────
function createDayNightButton(onToggle: (isNight: boolean) => void): HTMLButtonElement {
  const btn = document.createElement('button');
  Object.assign(btn.style, {
    position:       'fixed',
    top:            '14px',
    right:          '14px',
    zIndex:         '500',
    background:     'rgba(22,24,29,0.88)',
    color:          '#e7e7ea',
    border:         '1px solid rgba(255,255,255,0.14)',
    borderRadius:   '8px',
    padding:        '8px 14px',
    fontSize:       '13px',
    fontWeight:     '600',
    fontFamily:     'Inter, system-ui, Arial',
    cursor:         'pointer',
    backdropFilter: 'blur(6px)',
    display:        'flex',
    alignItems:     'center',
    gap:            '6px',
    transition:     'border-color 0.2s',
    userSelect:     'none',
  });
  btn.innerHTML = '☀️ <span>Day Mode</span>';

  let night = false;
  btn.addEventListener('click', () => {
    night = !night;
    btn.innerHTML = night ? '🌙 <span>Night Mode</span>' : '☀️ <span>Day Mode</span>';
    onToggle(night);
  });
  btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#5ab0ff'; });
  btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(255,255,255,0.14)'; });

  document.body.appendChild(btn);
  return btn;
}

// ─────────────────────────────────────────────────────────────────────────────

async function start() {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = DAY.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

  const artworks = await fetchMetadata();
  const imagesBase = `${import.meta.env.BASE_URL}images`;
  const { root, suggestedSpawn, bounds, colliders, proximityPoints, rooms, lightingRefs } =
    buildGallery(scene, { imagesBase, artworks, renderer });
  camera.position.copy(suggestedSpawn);

  // Collect billboard meshes (statue name labels)
  const billboards: import('three').Object3D[] = [];
  scene.traverse((obj) => {
    if (obj.userData['isBillboard']) billboards.push(obj);
  });

  const { update, setBounds, setColliders } = createControls(
    camera,
    renderer.domElement,
    bounds,
    colliders,
    proximityPoints,
    rooms,
    billboards
  );
  setBounds(bounds);
  setColliders(colliders);

  // ── Day/Night transition state ──────────────────────────────────────────────
  let nightT     = 0.0;   // 0 = full day, 1 = full night
  let nightTarget = 0.0;
  const TRANSITION_SPEED = 0.8; // fraction per second

  createDayNightButton((isNight) => { nightTarget = isNight ? 1 : 0; });

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  let last = performance.now();

  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;

    // Lerp day/night transition
    if (nightT !== nightTarget) {
      nightT += (nightTarget - nightT) * Math.min(TRANSITION_SPEED * dt * 3, 1);
      if (Math.abs(nightT - nightTarget) < 0.001) nightT = nightTarget;

      const t = nightT;
      scene.background = DAY.bg.clone().lerp(NIGHT.bg, t);
      (scene.fog as FogExp2).density = lerp(DAY.fogDensity, NIGHT.fogDensity, t);
      lightingRefs.amb.intensity      = lerp(DAY.ambInt,    NIGHT.ambInt,    t);
      lightingRefs.hemi.intensity     = lerp(DAY.hemiInt,   NIGHT.hemiInt,   t);
      lightingRefs.sun.intensity      = lerp(DAY.sunInt,    NIGHT.sunInt,    t);
      lightingRefs.nightFill.intensity = lerp(DAY.nightInt,   NIGHT.nightInt,   t);
      renderer.toneMappingExposure    = lerp(DAY.exposure,   NIGHT.exposure,   t);
      // Per-statue spotlights — ramp up in night mode, off in day
      const si = lerp(DAY.statueInt, NIGHT.statueInt, t);
      for (const sl of lightingRefs.statueLights) sl.intensity = si;
      // Room-level painting wash lights
      const wi = lerp(DAY.washInt, NIGHT.washInt, t);
      for (const wl of lightingRefs.pictureWashLights) wl.intensity = wi;
    }

    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

start();