import { PerspectiveCamera, Vector3 } from 'three';
import type { Bounds, RectXZ } from './types';

export function createControls(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  bounds?: Bounds,
  colliders: RectXZ[] = []
) {
  const keys = new Set<string>();
  window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup',   e => keys.delete(e.key.toLowerCase()));

  // Pointer-lock
  let isLocked = false;
  const sensitivity = 0.0025;
  let yaw = 0, pitch = 0;

  canvas.addEventListener('click', () => canvas.requestPointerLock());
  document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!isLocked) return;
    yaw   -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    const lim = Math.PI/2 - 0.08;
    pitch = Math.max(-lim, Math.min(lim, pitch));
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  });

  const UP = new Vector3(0,1,0);
  const forwardDir = new Vector3();
  const rightDir = new Vector3();
  const move = new Vector3();

  const playerRadius = 0.35; // ~shoulder width

  const clampBounds = (v: Vector3) => {
    if (!bounds) return;
    v.x = Math.min(bounds.maxX, Math.max(bounds.minX, v.x));
    v.y = Math.min(bounds.maxY, Math.max(bounds.minY, v.y));
    v.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, v.z));
  };

  const collides = (x: number, z: number) => {
    for (const r of colliders) {
      const hit =
        x > (r.minX - playerRadius) && x < (r.maxX + playerRadius) &&
        z > (r.minZ - playerRadius) && z < (r.maxZ + playerRadius);
      if (hit) return true;
    }
    return false;
  };

  function update(dt: number) {
    if (!isLocked) return;

    const speed = 3.0;
    const fwd = (keys.has('w') || keys.has('arrowup')) ? 1 :
                (keys.has('s') || keys.has('arrowdown')) ? -1 : 0;
    const str = (keys.has('d') || keys.has('arrowright')) ? 1 :
                (keys.has('a') || keys.has('arrowleft')) ? -1 : 0;

    forwardDir.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
    rightDir.crossVectors(forwardDir, UP).normalize();

    move.set(0,0,0)
      .addScaledVector(forwardDir, fwd * speed * dt)
      .addScaledVector(rightDir,   str * speed * dt);

    // Swept collision: resolve per-axis to allow sliding
    let nextX = camera.position.x + move.x;
    let nextZ = camera.position.z;

    if (!collides(nextX, nextZ)) {
      camera.position.x = nextX;
    }
    nextZ = camera.position.z + move.z;
    if (!collides(camera.position.x, nextZ)) {
      camera.position.z = nextZ;
    }

    clampBounds(camera.position);
  }

  return {
    update,
    setBounds: (b: Bounds) => (bounds = b),
    setColliders: (c: RectXZ[]) => (colliders = c),
  };
}