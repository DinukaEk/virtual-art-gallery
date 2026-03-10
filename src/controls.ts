import { PerspectiveCamera, Vector3, Object3D } from 'three';
import type { Bounds, RectXZ } from './types';
import type { ProximityPoint } from './gallery';

type RoomRect = { x0: number; x1: number; z0: number; z1: number };

// ─── Minimap ──────────────────────────────────────────────────────────────────

function setupMinimap(
  rooms: RoomRect[],
  getPoints: () => ProximityPoint[]
): { update: (camera: PerspectiveCamera) => void } {
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', right: '16px', bottom: '16px',
    width: '170px', height: '170px', zIndex: '999',
    borderRadius: '12px', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
    pointerEvents: 'none',
  });

  const cvs = document.createElement('canvas');
  const S = 340;
  cvs.width = S; cvs.height = S;
  Object.assign(cvs.style, { position:'absolute', inset:'0', width:'100%', height:'100%', display:'block' });
  container.appendChild(cvs);

  const lbl = document.createElement('div');
  Object.assign(lbl.style, {
    position:'absolute', bottom:'5px', left:'50%', transform:'translateX(-50%)',
    fontSize:'9px', color:'rgba(255,255,255,0.35)', letterSpacing:'0.6px',
    textTransform:'uppercase', pointerEvents:'none', whiteSpace:'nowrap',
    fontFamily:'Inter, system-ui, Arial',
  });
  lbl.textContent = 'Gallery Map';
  container.appendChild(lbl);
  document.body.appendChild(container);

  const ctx = cvs.getContext('2d')!;
  const worldMinX = Math.min(...rooms.map(r => r.x0));
  const worldMaxX = Math.max(...rooms.map(r => r.x1));
  const worldMinZ = Math.min(...rooms.map(r => r.z0));
  const worldMaxZ = Math.max(...rooms.map(r => r.z1));
  const worldW = worldMaxX - worldMinX, worldH = worldMaxZ - worldMinZ;
  const PAD = 14, drawW = S - PAD * 2, drawH = S - PAD * 2;
  const toMap = (wx: number, wz: number) => ({
    x: PAD + ((wx - worldMinX) / worldW) * drawW,
    y: PAD + ((wz - worldMinZ) / worldH) * drawH,
  });

  function draw(camera: PerspectiveCamera) {
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(8,10,14,0.82)';
    ctx.beginPath(); ctx.roundRect(0, 0, S, S, 20); ctx.fill();

    for (const r of rooms) {
      const tl = toMap(r.x0, r.z0), br = toMap(r.x1, r.z1);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }
    for (const p of getPoints()) {
      const m = toMap(p.x, p.z);
      ctx.beginPath();
      ctx.arc(m.x, m.y, p.kind === 'statue' ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = p.kind === 'statue' ? 'rgba(255,200,80,0.9)' : 'rgba(90,176,255,0.7)';
      ctx.fill();
    }
    const pm = toMap(camera.position.x, camera.position.z);
    const dir = new Vector3();
    camera.getWorldDirection(dir);
    const playerYaw = Math.atan2(dir.x, dir.z);
    const wedgeLen = 26, halfFov = Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(pm.x, pm.y);
    ctx.lineTo(pm.x + Math.sin(playerYaw - halfFov) * wedgeLen, pm.y + Math.cos(playerYaw - halfFov) * wedgeLen);
    ctx.lineTo(pm.x + Math.sin(playerYaw + halfFov) * wedgeLen, pm.y + Math.cos(playerYaw + halfFov) * wedgeLen);
    ctx.closePath();
    ctx.fillStyle = 'rgba(90,176,255,0.2)'; ctx.fill();
    ctx.beginPath(); ctx.arc(pm.x, pm.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#5ab0ff'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  }
  return { update: draw };
}

// ─── Artwork Plaque ───────────────────────────────────────────────────────────

function setupPlaque() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position:'fixed', left:'50%', bottom:'26px',
    transform:'translateX(-50%) translateY(10px)',
    zIndex:'998', background:'rgba(12,13,16,0.9)', backdropFilter:'blur(8px)',
    border:'1px solid rgba(255,255,255,0.13)', padding:'10px 18px',
    borderRadius:'10px', minWidth:'240px', maxWidth:'60vw', textAlign:'center',
    opacity:'0', pointerEvents:'none',
    transition:'opacity 0.25s ease, transform 0.25s ease',
    fontFamily:'Inter, system-ui, Arial', color:'#e7e7ea',
  });
  const titleEl = document.createElement('div');
  Object.assign(titleEl.style, { fontWeight:'600', fontSize:'15px', marginBottom:'2px' });
  const metaEl = document.createElement('div');
  Object.assign(metaEl.style, { fontSize:'12px', color:'#b7b8bd' });
  el.appendChild(titleEl); el.appendChild(metaEl);
  document.body.appendChild(el);

  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  return {
    show(p: ProximityPoint) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      titleEl.textContent = p.label; metaEl.textContent = p.sublabel ?? '';
      el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)';
    },
    hide() {
      if (hideTimer) return;
      hideTimer = setTimeout(() => {
        el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(10px)';
        hideTimer = null;
      }, 400);
    },
  };
}

// ─── Onboarding Overlay ───────────────────────────────────────────────────────

function injectOnboarding(canvas: HTMLCanvasElement, onEnter: () => void) {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position:'fixed', top:'0', left:'0', width:'100vw', height:'100vh',
    zIndex:'99999', display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    background:'rgba(8,9,12,0.95)', backdropFilter:'blur(12px)',
    fontFamily:'Inter, system-ui, Arial', color:'#e7e7ea',
    transition:'opacity 0.4s ease', opacity:'1',
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
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:4px 9px;font-size:13px;font-weight:600;font-family:monospace;flex-shrink:0">↑↓←→</span>
        <span style="font-size:13px;color:#b7b8bd">Arrow keys too</span>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
        <span style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:4px 9px;font-size:13px;font-weight:600;font-family:monospace;flex-shrink:0">Esc</span>
        <span style="font-size:13px;color:#b7b8bd">Release cursor</span>
      </div>
    </div>
    <button id="enter-gallery-btn" style="background:#5ab0ff;color:#000;font-weight:700;font-size:16px;border:none;border-radius:10px;padding:14px 40px;cursor:pointer;box-shadow:0 0 24px rgba(90,176,255,0.45);font-family:Inter,system-ui,Arial">
      Enter Gallery
    </button>
  `;
  document.body.appendChild(el);

  const btn = document.getElementById('enter-gallery-btn')!;
  btn.addEventListener('mouseenter', () => { (btn as HTMLElement).style.transform = 'scale(1.05)'; });
  btn.addEventListener('mouseleave', () => { (btn as HTMLElement).style.transform = 'scale(1)'; });
  btn.addEventListener('click', () => {
    canvas.requestPointerLock();
    el.style.opacity = '0'; el.style.pointerEvents = 'none';
    setTimeout(() => el.remove(), 450);
    onEnter();
  });
}

// ─── Mobile Touch Joysticks ───────────────────────────────────────────────────

type JoystickState = { dx: number; dy: number };

function createJoystick(
  side: 'left' | 'right',
  label: string
): { state: JoystickState; el: HTMLElement } {
  const SIZE  = 110;
  const KNOB  = 42;
  const RANGE = (SIZE - KNOB) / 2;

  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position:        'fixed',
    bottom:          '30px',
    [side]:          '30px',
    width:           `${SIZE}px`,
    height:          `${SIZE}px`,
    borderRadius:    '50%',
    background:      'rgba(255,255,255,0.08)',
    border:          '2px solid rgba(255,255,255,0.18)',
    zIndex:          '900',
    display:         'none',   // hidden until touch device detected
    alignItems:      'center',
    justifyContent:  'center',
    touchAction:     'none',
    userSelect:      'none',
  });

  const knob = document.createElement('div');
  Object.assign(knob.style, {
    width:        `${KNOB}px`,
    height:       `${KNOB}px`,
    borderRadius: '50%',
    background:   'rgba(255,255,255,0.3)',
    border:       '2px solid rgba(255,255,255,0.5)',
    position:     'absolute',
    transition:   'transform 0.05s',
    pointerEvents:'none',
  });

  const lbl = document.createElement('div');
  Object.assign(lbl.style, {
    position:  'absolute',
    top:       '-22px', left:'50%', transform:'translateX(-50%)',
    fontSize:  '10px', color:'rgba(255,255,255,0.4)',
    fontFamily:'Inter,system-ui,Arial', whiteSpace:'nowrap', pointerEvents:'none',
  });
  lbl.textContent = label;

  wrap.appendChild(knob);
  wrap.appendChild(lbl);
  document.body.appendChild(wrap);

  const state: JoystickState = { dx: 0, dy: 0 };
  let activeTouchId: number | null = null;
  let originX = 0, originY = 0;

  const onStart = (e: TouchEvent) => {
    e.preventDefault();
    if (activeTouchId !== null) return;
    const t = e.changedTouches[0];
    activeTouchId = t.identifier;
    const rect = wrap.getBoundingClientRect();
    originX = rect.left + SIZE / 2;
    originY = rect.top  + SIZE / 2;
  };

  const onMove = (e: TouchEvent) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== activeTouchId) continue;
      let dx = t.clientX - originX;
      let dy = t.clientY - originY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > RANGE) { dx *= RANGE / dist; dy *= RANGE / dist; }
      state.dx = dx / RANGE;
      state.dy = dy / RANGE;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  };

  const onEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== activeTouchId) continue;
      activeTouchId = null;
      state.dx = 0; state.dy = 0;
      knob.style.transform = 'translate(0,0)';
    }
  };

  wrap.addEventListener('touchstart',  onStart, { passive: false });
  wrap.addEventListener('touchmove',   onMove,  { passive: false });
  wrap.addEventListener('touchend',    onEnd,   { passive: false });
  wrap.addEventListener('touchcancel', onEnd,   { passive: false });

  return { state, el: wrap };
}

function setupTouchControls(): { moveStick: JoystickState; lookStick: JoystickState } {
  // Only show joysticks if this is a touch device
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  const move = createJoystick('left',  'Move');
  const look = createJoystick('right', 'Look');

  if (isTouch) {
    move.el.style.display = 'flex';
    look.el.style.display = 'flex';
    // Shift minimap up so it doesn't overlap the right joystick
    const minimap = document.getElementById('minimap');
    if (minimap) minimap.style.bottom = '170px';
  }

  return { moveStick: move.state, lookStick: look.state };
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
    canvas.addEventListener('click', () => { if (!isLocked) canvas.requestPointerLock(); });
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

  const UP         = new Vector3(0, 1, 0);
  const forwardDir = new Vector3();
  const rightDir   = new Vector3();
  const velocity   = new Vector3();          // smooth velocity vector
  const ACCEL      = 18.0;                   // acceleration (units/s²)
  const DAMPING    = 12.0;                   // deceleration multiplier
  const MAX_SPEED  = 4.5;
  const playerRadius = 0.35;

  const minimap = rooms.length > 0 ? setupMinimap(rooms, () => proximityPoints) : null;
  const plaque  = setupPlaque();
  const PLAQUE_DIST = 3.0;

  // Mobile touch joysticks
  const { moveStick, lookStick } = setupTouchControls();
  const TOUCH_LOOK_SENS = 1.8; // look joystick sensitivity multiplier

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
    // Apply touch look joystick even without pointer lock (mobile users)
    if (lookStick.dx !== 0 || lookStick.dy !== 0) {
      yaw   -= lookStick.dx * TOUCH_LOOK_SENS * dt;
      pitch -= lookStick.dy * TOUCH_LOOK_SENS * dt;
      const lim = Math.PI / 2 - 0.08;
      pitch = Math.max(-lim, Math.min(lim, pitch));
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }

    // Keyboard inputs
    const kFwd = (keys.has('w') || keys.has('arrowup'))    ?  1 :
                 (keys.has('s') || keys.has('arrowdown'))  ? -1 : 0;
    const kStr = (keys.has('d') || keys.has('arrowright')) ?  1 :
                 (keys.has('a') || keys.has('arrowleft'))  ? -1 : 0;

    // Touch move joystick (left stick: dy=forward, dx=strafe)
    const tFwd = -moveStick.dy;
    const tStr =  moveStick.dx;

    // Combine keyboard + touch
    const inputFwd = Math.max(-1, Math.min(1, kFwd + tFwd));
    const inputStr = Math.max(-1, Math.min(1, kStr + tStr));
    const hasInput = inputFwd !== 0 || inputStr !== 0;

    // Only move if locked (desktop) OR touch input (mobile)
    const canMove = isLocked || (moveStick.dx !== 0 || moveStick.dy !== 0);
    if (!canMove && !hasInput) {
      // Damp to zero
      velocity.multiplyScalar(Math.max(0, 1 - DAMPING * dt));
    }

    if (hasInput) {
      forwardDir.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
      rightDir.crossVectors(forwardDir, UP).normalize();

      // Target velocity direction
      const targetX = forwardDir.x * inputFwd + rightDir.x * inputStr;
      const targetZ = forwardDir.z * inputFwd + rightDir.z * inputStr;

      // Accelerate toward target
      velocity.x += (targetX * MAX_SPEED - velocity.x) * Math.min(ACCEL * dt, 1);
      velocity.z += (targetZ * MAX_SPEED - velocity.z) * Math.min(ACCEL * dt, 1);
    } else {
      // Decelerate smoothly
      velocity.x *= Math.max(0, 1 - DAMPING * dt);
      velocity.z *= Math.max(0, 1 - DAMPING * dt);
    }

    // Clamp to max speed
    const spd = Math.sqrt(velocity.x ** 2 + velocity.z ** 2);
    if (spd > MAX_SPEED) { velocity.x *= MAX_SPEED / spd; velocity.z *= MAX_SPEED / spd; }

    // Apply per-axis with collision
    const nextX = camera.position.x + velocity.x * dt;
    if (!collides(nextX, camera.position.z)) camera.position.x = nextX;
    else velocity.x = 0;

    const nextZ = camera.position.z + velocity.z * dt;
    if (!collides(camera.position.x, nextZ)) camera.position.z = nextZ;
    else velocity.z = 0;

    clampBounds(camera.position);

    // Billboard labels face camera
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
    setBounds:    (b: Bounds)    => { bounds   = b; },
    setColliders: (c: RectXZ[]) => { colliders = c; },
  };
}