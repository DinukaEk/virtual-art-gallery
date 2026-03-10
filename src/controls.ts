import { PerspectiveCamera, Vector3, Object3D } from 'three';
import type { Bounds, RectXZ } from './types';
import type { ProximityPoint } from './gallery';

type RoomRect = { x0: number; x1: number; z0: number; z1: number };

// ─── Minimap ──────────────────────────────────────────────────────────────────

function setupMinimap(
  rooms: RoomRect[],
  getPoints: () => ProximityPoint[]
): { update: (camera: PerspectiveCamera) => void } {

  // All styles inline — independent of any CSS file or HTML structure
  const container = document.createElement('div');
  Object.assign(container.style, {
    position:        'fixed',
    right:           '16px',
    bottom:          '16px',
    width:           '170px',
    height:          '170px',
    zIndex:          '999',
    borderRadius:    '12px',
    overflow:        'hidden',
    border:          '1px solid rgba(255,255,255,0.18)',
    boxShadow:       '0 6px 24px rgba(0,0,0,0.7)',
    pointerEvents:   'none',
    backgroundColor: 'rgba(10,11,15,0.0)', // transparent — canvas draws its own bg
  });

  const cvs = document.createElement('canvas');
  const S = 340; // internal resolution (2× for sharp rendering)
  cvs.width = S; cvs.height = S;
  Object.assign(cvs.style, {
    position: 'absolute',
    inset:    '0',
    width:    '100%',
    height:   '100%',
    display:  'block',
  });
  container.appendChild(cvs);

  const lbl = document.createElement('div');
  Object.assign(lbl.style, {
    position:   'absolute',
    bottom:     '5px',
    left:       '50%',
    transform:  'translateX(-50%)',
    fontSize:   '9px',
    color:      'rgba(255,255,255,0.35)',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    pointerEvents: 'none',
    whiteSpace:    'nowrap',
    fontFamily:    'Inter, system-ui, Arial',
  });
  lbl.textContent = 'Gallery Map';
  container.appendChild(lbl);

  document.body.appendChild(container);

  const ctx = cvs.getContext('2d')!;

  const worldMinX = Math.min(...rooms.map(r => r.x0));
  const worldMaxX = Math.max(...rooms.map(r => r.x1));
  const worldMinZ = Math.min(...rooms.map(r => r.z0));
  const worldMaxZ = Math.max(...rooms.map(r => r.z1));
  const worldW = worldMaxX - worldMinX;
  const worldH = worldMaxZ - worldMinZ;
  const PAD = 14;
  const drawW = S - PAD * 2;
  const drawH = S - PAD * 2;

  const toMap = (wx: number, wz: number) => ({
    x: PAD + ((wx - worldMinX) / worldW) * drawW,
    y: PAD + ((wz - worldMinZ) / worldH) * drawH,
  });

  function draw(camera: PerspectiveCamera) {
    // Clear with a semi-transparent dark bg drawn on the canvas itself
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(8,10,14,0.82)';
    ctx.beginPath();
    ctx.roundRect(0, 0, S, S, 20);
    ctx.fill();

    // Rooms
    for (const r of rooms) {
      const tl = toMap(r.x0, r.z0);
      const br = toMap(r.x1, r.z1);
      ctx.fillStyle   = 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth   = 2;
      ctx.fillRect  (tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    // Dots — lazily read so statues loaded after init appear
    for (const p of getPoints()) {
      const m = toMap(p.x, p.z);
      ctx.beginPath();
      ctx.arc(m.x, m.y, p.kind === 'statue' ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = p.kind === 'statue'
        ? 'rgba(255,200,80,0.9)'
        : 'rgba(90,176,255,0.7)';
      ctx.fill();
    }

    // Player FOV wedge + dot
    const pm = toMap(camera.position.x, camera.position.z);
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    const playerYaw = Math.atan2(dir.x, dir.z);
    const wedgeLen  = 26;
    const halfFov   = Math.PI / 6;

    ctx.beginPath();
    ctx.moveTo(pm.x, pm.y);
    ctx.lineTo(pm.x + Math.sin(playerYaw - halfFov) * wedgeLen,
               pm.y + Math.cos(playerYaw - halfFov) * wedgeLen);
    ctx.lineTo(pm.x + Math.sin(playerYaw + halfFov) * wedgeLen,
               pm.y + Math.cos(playerYaw + halfFov) * wedgeLen);
    ctx.closePath();
    ctx.fillStyle = 'rgba(90,176,255,0.2)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(pm.x, pm.y, 6, 0, Math.PI * 2);
    ctx.fillStyle   = '#5ab0ff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 2;
    ctx.stroke();
  }

  return { update: draw };
}

// ─── Artwork Plaque ───────────────────────────────────────────────────────────

function setupPlaque() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position:        'fixed',
    left:            '50%',
    bottom:          '26px',
    transform:       'translateX(-50%) translateY(10px)',
    zIndex:          '998',
    background:      'rgba(12,13,16,0.9)',
    backdropFilter:  'blur(8px)',
    border:          '1px solid rgba(255,255,255,0.13)',
    padding:         '10px 18px',
    borderRadius:    '10px',
    minWidth:        '240px',
    maxWidth:        '60vw',
    textAlign:       'center',
    opacity:         '0',
    pointerEvents:   'none',
    transition:      'opacity 0.25s ease, transform 0.25s ease',
    fontFamily:      'Inter, system-ui, Arial',
    color:           '#e7e7ea',
  });

  const titleEl = document.createElement('div');
  Object.assign(titleEl.style, { fontWeight: '600', fontSize: '15px', marginBottom: '2px' });

  const metaEl = document.createElement('div');
  Object.assign(metaEl.style, { fontSize: '12px', color: '#b7b8bd' });

  el.appendChild(titleEl);
  el.appendChild(metaEl);
  document.body.appendChild(el);

  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    show(p: ProximityPoint) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      titleEl.textContent = p.label;
      metaEl.textContent  = p.sublabel ?? '';
      el.style.opacity   = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    },
    hide() {
      if (hideTimer) return;
      hideTimer = setTimeout(() => {
        el.style.opacity   = '0';
        el.style.transform = 'translateX(-50%) translateY(10px)';
        hideTimer = null;
      }, 400);
    },
  };
}

// ─── Onboarding Overlay ───────────────────────────────────────────────────────

function injectOnboarding(canvas: HTMLCanvasElement, onEnter: () => void) {
  const el = document.createElement('div');

  // All styles inline at highest possible z-index — nothing can hide this
  Object.assign(el.style, {
    position:        'fixed',
    top:             '0',
    left:            '0',
    width:           '100vw',
    height:          '100vh',
    zIndex:          '99999',         // highest possible
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    background:      'rgba(8,9,12,0.95)',
    backdropFilter:  'blur(12px)',
    fontFamily:      'Inter, system-ui, Arial',
    color:           '#e7e7ea',
    transition:      'opacity 0.4s ease',
    opacity:         '1',
  });

  el.innerHTML = `
    <h1 style="font-size:clamp(24px,4vw,40px);font-weight:700;letter-spacing:-0.5px;margin:0 0 8px;color:#fff">
      Virtual Art Gallery
    </h1>
    <p style="font-size:15px;color:#b7b8bd;margin:0 0 36px">
      Explore the collection at your own pace
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:36px;max-width:420px;width:100%;padding:0 20px">
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:4px 9px;font-size:13px;font-weight:600;font-family:monospace;flex-shrink:0">W A S D</span>
        <span style="font-size:13px;color:#b7b8bd">Move around</span>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:4px 9px;font-size:13px;font-weight:600;font-family:monospace;flex-shrink:0">Mouse</span>
        <span style="font-size:13px;color:#b7b8bd">Look around</span>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:4px 9px;font-size:13px;font-weight:600;font-family:monospace;flex-shrink:0">↑ ↓ ← →</span>
        <span style="font-size:13px;color:#b7b8bd">Arrow keys too</span>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:4px 9px;font-size:13px;font-weight:600;font-family:monospace;flex-shrink:0">Esc</span>
        <span style="font-size:13px;color:#b7b8bd">Release cursor</span>
      </div>
    </div>
    <button id="enter-gallery-btn" style="background:#5ab0ff;color:#000;font-weight:700;font-size:16px;border:none;border-radius:10px;padding:14px 40px;cursor:pointer;box-shadow:0 0 24px rgba(90,176,255,0.45);font-family:Inter,system-ui,Arial;transition:transform 0.15s,box-shadow 0.15s">
      Enter Gallery
    </button>
  `;

  // Append directly to <body> — guarantees it's in the document
  document.body.appendChild(el);

  const btn = document.getElementById('enter-gallery-btn')!;

  btn.addEventListener('mouseenter', () => {
    (btn as HTMLButtonElement).style.transform  = 'scale(1.05)';
    (btn as HTMLButtonElement).style.boxShadow  = '0 0 34px rgba(90,176,255,0.65)';
  });
  btn.addEventListener('mouseleave', () => {
    (btn as HTMLButtonElement).style.transform  = 'scale(1)';
    (btn as HTMLButtonElement).style.boxShadow  = '0 0 24px rgba(90,176,255,0.45)';
  });

  // pointer lock MUST be called synchronously inside the click handler
  btn.addEventListener('click', () => {
    canvas.requestPointerLock();
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    setTimeout(() => el.remove(), 450);
    onEnter();
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function createControls(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  bounds?: Bounds,
  colliders:       RectXZ[]         = [],
  proximityPoints: ProximityPoint[]  = [],
  rooms:           RoomRect[]        = [],
  billboards:      Object3D[]        = []
) {
  const keys = new Set<string>();
  window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup',   e => keys.delete(e.key.toLowerCase()));

  let isLocked = false;
  const sensitivity = 0.0025;
  let yaw = 0, pitch = 0;

  injectOnboarding(canvas, () => {
    // After entering, re-lock on canvas click (e.g. after Esc)
    canvas.addEventListener('click', () => {
      if (!isLocked) canvas.requestPointerLock();
    });
  });

  document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === canvas;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isLocked) return;
    yaw   -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    const lim = Math.PI / 2 - 0.08;
    pitch = Math.max(-lim, Math.min(lim, pitch));
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  });

  const UP          = new Vector3(0, 1, 0);
  const forwardDir  = new Vector3();
  const rightDir    = new Vector3();
  const move        = new Vector3();
  const playerRadius = 0.35;

  const minimap = rooms.length > 0
    ? setupMinimap(rooms, () => proximityPoints)
    : null;

  const plaque    = setupPlaque();
  const PLAQUE_DIST = 3.0;

  const clampBounds = (v: Vector3) => {
    if (!bounds) return;
    v.x = Math.min(bounds.maxX, Math.max(bounds.minX, v.x));
    v.y = Math.min(bounds.maxY, Math.max(bounds.minY, v.y));
    v.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, v.z));
  };

  const collides = (x: number, z: number) => {
    for (const r of colliders) {
      if (x > r.minX - playerRadius && x < r.maxX + playerRadius &&
          z > r.minZ - playerRadius && z < r.maxZ + playerRadius) return true;
    }
    return false;
  };

  function update(dt: number) {
    if (!isLocked) return;

    const speed = 3.0;
    const fwd = (keys.has('w') || keys.has('arrowup'))    ?  1 :
                (keys.has('s') || keys.has('arrowdown'))  ? -1 : 0;
    const str = (keys.has('d') || keys.has('arrowright')) ?  1 :
                (keys.has('a') || keys.has('arrowleft'))  ? -1 : 0;

    forwardDir.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    rightDir.crossVectors(forwardDir, UP).normalize();

    move.set(0, 0, 0)
      .addScaledVector(forwardDir, fwd * speed * dt)
      .addScaledVector(rightDir,   str * speed * dt);

    const nextX = camera.position.x + move.x;
    if (!collides(nextX, camera.position.z)) camera.position.x = nextX;
    const nextZ = camera.position.z + move.z;
    if (!collides(camera.position.x, nextZ)) camera.position.z = nextZ;

    clampBounds(camera.position);

    for (const obj of billboards) obj.rotation.y = yaw;

    // Proximity plaque
    let closest: ProximityPoint | null = null;
    let closestDist = PLAQUE_DIST;
    const px = camera.position.x, pz = camera.position.z;
    for (const p of proximityPoints) {
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < closestDist) { closestDist = d; closest = p; }
    }
    if (closest) plaque.show(closest); else plaque.hide();

    minimap?.update(camera);
  }

  return {
    update,
    setBounds:    (b: Bounds)    => { bounds    = b; },
    setColliders: (c: RectXZ[]) => { colliders  = c; },
  };
}