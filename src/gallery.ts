import * as THREE from 'three';
import {
  Scene, Group, Color, Vector3, Mesh,
  MeshStandardMaterial, AmbientLight, HemisphereLight, DirectionalLight,
  FogExp2, TextureLoader, RepeatWrapping, SRGBColorSpace,
  BoxGeometry, PlaneGeometry, DoubleSide,
  SphereGeometry, CylinderGeometry,
  Box3, Quaternion, SpotLight, PointLight,
  InstancedMesh, Matrix4, NearestMipmapLinearFilter, LinearMipmapLinearFilter
} from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { Frame } from './frame';
import type { ArtworkMeta, Bounds, RectXZ } from './types';

const BASE = import.meta.env.BASE_URL;


/** Pedestal (0.6m cube + 0.2m top) returned as a Group */
function makePedestal(): Group {
  const g = new Group();
  const base = new Mesh(
    new BoxGeometry(0.6, 0.6, 0.6),
    new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.85, metalness: 0 })
  );
  base.castShadow = true; base.receiveShadow = true;
  base.position.y = 0.3;

  const top = new Mesh(
    new BoxGeometry(0.7, 0.2, 0.7),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 })
  );
  top.position.y = 0.6 + 0.1;
  top.castShadow = true; top.receiveShadow = true;

  g.add(base, top);
  return g;
}

/** Load a statue (OBJ+MTL). `base` is the folder containing both files. */
function loadStatueOBJ(base: string, objName: string, mtlName: string): Promise<Group> {
  return new Promise((resolve, reject) => {
    const mtl = new MTLLoader().setPath(base).setResourcePath(base);
    mtl.load(mtlName, (materials) => {
      materials.preload();
      const obj = new OBJLoader().setPath(base).setMaterials(materials);
      obj.load(
        objName,
        (root) => {
          root.traverse((o: any) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              // Force marble look if the MTL is too dark
              if (o.material && !o.material.map) {
                o.material = new MeshStandardMaterial({
                  color: 0xeeeeee, roughness: 0.5, metalness: 0.05
                });
              } else if (o.material) {
                o.material.roughness = 0.5;
                o.material.metalness = 0.05;
              }
            }
          });
          resolve(root);
        },
        undefined,
        reject
      );
    }, undefined, reject);
  });
}

/** Very light fallback “abstract statue” if model fails to load */
function makeAbstractStatue(): Group {
  const g = makePedestal();
  const body = new Mesh(
    new BoxGeometry(0.3, 0.5, 0.3),
    new MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 })
  );
  body.position.y = 0.6 + 0.1 + 0.25;
  body.castShadow = true;
  g.add(body);
  return g;
}

/**
 * Add one statue at the center of each section rectangle.
 * Sections are rectangles we compute from your existing room layout & dividers.
 */
/** Proximity record for a statue or artwork — used by controls for plaque & minimap */
export type ProximityPoint = {
  x: number; z: number;
  label: string; sublabel?: string;
  kind: 'statue' | 'artwork';
};

async function addStatuesAtSectionCenters(
  scene: Scene,
  sections: Array<{x0:number;x1:number;z0:number;z1:number}>,
  proximityPoints: ProximityPoint[],
  statueLights: SpotLight[]
) {
  // ── Statue loading progress bar ───────────────────────────────────────────
  const total = sections.length;
  let loaded = 0;

  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'fixed', bottom: '0', left: '0', width: '0%', height: '3px',
    background: 'linear-gradient(90deg, #5ab0ff, #a78bfa)',
    zIndex: '99998', transition: 'width 0.3s ease', pointerEvents: 'none',
    boxShadow: '0 0 8px rgba(90,176,255,0.6)',
  });
  document.body.appendChild(bar);

  const tick = () => {
    loaded++;
    bar.style.width = `${Math.round((loaded / total) * 100)}%`;
    if (loaded >= total) {
      setTimeout(() => { bar.style.opacity = '0'; setTimeout(() => bar.remove(), 400); }, 300);
    }
  };
  const PACKS = [
    { base: `${BASE}models/statues/David/`, obj: '12330_Statue_v1_L2.obj', mtl: '12330_Statue_v1_L2.mtl', scale: 0.003, name: 'David', credit: 'Michelangelo, c. 1504' },
    { base: `${BASE}models/statues/Shiva/`, obj: '12337_Statue_v1_l1.obj', mtl: '12337_Statue_v1_l1.mtl', scale: 0.001, name: 'Nataraja (Shiva)', credit: 'South Indian, c. 10th century' },
    { base: `${BASE}models/statues/The_Thinker/`, obj: '12335_The_Thinker_v3_l2.obj', mtl: '12335_The_Thinker_v3_l2.mtl', scale: 0.002, name: 'The Thinker', credit: 'Auguste Rodin, 1904' },
    { base: `${BASE}models/statues/Statue1/`, obj: '12328_Statue_v1_L2.obj', mtl: '12328_Statue_v1_L2.mtl', scale: 0.007, name: 'Classical Figure', credit: 'Greco-Roman, 2nd century BC' },
    { base: `${BASE}models/statues/Statue2/`, obj: '12338_Statue_v1_L3.obj', mtl: '12338_Statue_v1_L3.mtl', scale: 0.006, name: 'Draped Figure', credit: 'Hellenistic period' },
    { base: `${BASE}models/statues/EgyptianPharaoh/`, obj: '15778_NoveltyBust_EgyptianPharaoh_V1_NEW.obj', mtl: 'blank.mtl', scale: 0.02, name: 'Egyptian Pharaoh', credit: 'Ancient Egypt, c. 1350 BC' },
    { base: `${BASE}models/statues/buddah/`, obj: '12334_statue_v1_l3.obj', mtl: '12334_statue_v1_l3.mtl', scale: 0.002, name: 'Seated Buddha', credit: 'Gandharan, 2nd–3rd century' },
  ];

  for (let i = 0; i < sections.length; i++) {
    const r = sections[i];
    const cx = (r.x0 + r.x1) * 0.5;
    const cz = (r.z0 + r.z1) * 0.5;

    // Place pedestal first
    const pedestal = makePedestal();
    pedestal.position.set(cx, 0, cz);
    scene.add(pedestal);

    // Choose pack (cycle if fewer packs than sections)
    const pack = PACKS[i % PACKS.length];

    try {
      const statue = await loadStatueOBJ(pack.base, pack.obj, pack.mtl);

      // 1) Reset to clean orientation and apply scale
      statue.rotation.set(0, 0, 0);
      statue.scale.setScalar(pack.scale);
      statue.updateMatrixWorld(true);

      // 2) These OBJ models are exported Z-up (lying on their back at rest).
      //    Rotating -90deg around X brings the model +Z axis (its up) to world +Y,
      //    making every statue stand perfectly upright on the pedestal.
      statue.rotation.x = -Math.PI / 2;
      statue.updateMatrixWorld(true);

      // 3) Seat the base flush on top of the pedestal (pedestal top = y 0.8)
      const bbox = new Box3().setFromObject(statue);
      const lift = 0.8 - bbox.min.y;
      statue.position.set(cx, lift, cz);

      scene.add(statue);
      tick();

      // Spotlight aimed down at this statue — off in day mode, lit at night
      const statueSpot = new SpotLight(0xd0e8ff, 0.0, 7.0, Math.PI / 7, 0.5, 1.8);
      statueSpot.position.set(cx, 3.4, cz);
      statueSpot.target.position.set(cx, 0.8, cz);
      statueSpot.castShadow = false;
      scene.add(statueSpot, statueSpot.target);
      statueLights.push(statueSpot);

      // Floating name label above the pedestal
      addStatueLabel(scene, cx, cz, pack.name, pack.credit);

      // Register for proximity plaque
      proximityPoints.push({ x: cx, z: cz, label: pack.name, sublabel: pack.credit, kind: 'statue' });

    } catch {
      const fallback = makeAbstractStatue();
      fallback.position.set(cx, 0, cz);
      scene.add(fallback);
      tick();
    }
  }
}

/** Creates a floating canvas-texture name tag above a pedestal */
function addStatueLabel(scene: Scene, cx: number, cz: number, name: string, credit: string) {
  const W = 512, H = 96;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;

  // pill background
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(12,13,16,0.82)';
  const r = 18;
  g.beginPath();
  g.moveTo(r, 0); g.lineTo(W - r, 0);
  g.quadraticCurveTo(W, 0, W, r);
  g.lineTo(W, H - r); g.quadraticCurveTo(W, H, W - r, H);
  g.lineTo(r, H); g.quadraticCurveTo(0, H, 0, H - r);
  g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
  g.closePath(); g.fill();

  // border
  g.strokeStyle = 'rgba(255,255,255,0.13)';
  g.lineWidth = 2;
  g.stroke();

  // name text
  g.fillStyle = '#e7e7ea';
  g.font = 'bold 34px Inter, system-ui, Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name, W / 2, H * 0.38);

  // credit text
  g.fillStyle = '#b7b8bd';
  g.font = '22px Inter, system-ui, Arial';
  g.fillText(credit, W / 2, H * 0.72);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const geo = new THREE.PlaneGeometry(1.4, 1.4 * (H / W));
  const mesh = new Mesh(geo, mat);

  // float 0.25m above top of statue bounding box estimate (~2.5m total from ground)
  mesh.position.set(cx, 2.55, cz);
  // always face +Z so it's readable from the spawn side; billboard handled in main loop
  mesh.userData['isBillboard'] = true;
  scene.add(mesh);
}

type BuildOpts = { imagesBase: string; artworks: ArtworkMeta[]; renderer?: THREE.WebGLRenderer };

/** a straight wall segment we can hang to */
type WallSeg =
  | { kind: 'X';  z: number; x0: number; x1: number; nZ:  1 | -1 } // long along X, normal along Z
  | { kind: 'Z';  x: number; z0: number; z1: number; nX:  1 | -1 }; // long along Z, normal along X

export function buildGallery(scene: Scene, opts: BuildOpts) {
  // -----------------------------
  // Dimensions (meters)
  // -----------------------------
  const H = 3.6;                     // wall/ceiling height
  const WALL_T = 0.22;               // wall thickness
  const DOOR_W = 3.0;                // standard doorway width
  const WALL_GAP = 0.2;              // ~2 cm gap for frames from wall plane
  const CAP_MARGIN = 0.80;           // margin from segment edges when hanging
  const SPACING = 3.6;               // desired center-to-center spacing of frames
  const FRAME_W = 1.8;
  const HALF_W  = FRAME_W * 0.5;

  // Room rectangles (centered roughly around origin)
  // Atrium (main), North (forward), East (right), West (left)
  const R_ATRIUM = { x0: -16, x1:  16, z0: -10, z1:  10 };
  const R_NORTH  = { x0: -14, x1:  14, z0:  10, z1:  24 };
  const R_EAST   = { x0:  16, x1:  30, z0:  -8, z1:   8 };
  const R_WEST   = { x0: -30, x1: -16, z0:  -8, z1:   8 };

  // Global extents (for floor & bounds)
  const MIN_X = Math.min(R_ATRIUM.x0, R_NORTH.x0, R_EAST.x0, R_WEST.x0);
  const MAX_X = Math.max(R_ATRIUM.x1, R_NORTH.x1, R_EAST.x1, R_WEST.x1);
  const MIN_Z = Math.min(R_ATRIUM.z0, R_NORTH.z0, R_EAST.z0, R_WEST.z0);
  const MAX_Z = Math.max(R_ATRIUM.z1, R_NORTH.z1, R_EAST.z1, R_WEST.z1);
  const SIZE_X = MAX_X - MIN_X;
  const SIZE_Z = MAX_Z - MIN_Z;

  // -----------------------------
  // Scene look & fog
  // -----------------------------
  scene.background = new Color(0xf1f2f5);
  scene.fog = new FogExp2(0xe9ebef, 0.008);

  // -----------------------------
  // Textures & PBR materials
  // -----------------------------
  const tex = new TextureLoader();

  // Max anisotropy for sharp textures at grazing angles (floors, walls)
  const maxAniso = opts.renderer?.capabilities.getMaxAnisotropy() ?? 4;

  const floorTex =
    tex.load(`${BASE}textures/floor.jpg`, undefined, undefined, () => tex.load(`${BASE}textures/floor.png`));
  floorTex.wrapS = floorTex.wrapT = RepeatWrapping;
  floorTex.colorSpace = SRGBColorSpace;
  floorTex.minFilter = LinearMipmapLinearFilter;  // trilinear — sharpest mipmapping
  floorTex.anisotropy = maxAniso;
  floorTex.repeat.set(Math.ceil(SIZE_X / 4), Math.ceil(SIZE_Z / 4));

  const wallTex =
    tex.load(`${BASE}textures/wall.jpg`, undefined, undefined, () => tex.load(`${BASE}textures/wall.png`));
  wallTex.wrapS = wallTex.wrapT = RepeatWrapping;
  wallTex.colorSpace = SRGBColorSpace;
  wallTex.minFilter = LinearMipmapLinearFilter;
  wallTex.anisotropy = maxAniso;
  wallTex.repeat.set(2, 1);

  const floorMat = new MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.08 });
  const wallMat  = new MeshStandardMaterial({ map: wallTex,  roughness: 0.9,  metalness: 0.0, side: DoubleSide });
  const ceilMat  = new MeshStandardMaterial({ color: 0xffffff, roughness: 1.0, metalness: 0.0, side: DoubleSide });

  // Trim / decor materials
  const railMat  = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6, metalness: 0.0 });
  const trimMat  = new THREE.MeshStandardMaterial({ color: 0xededed, roughness: 0.85, metalness: 0.0 }); // picture rail
  const sconceMat = new MeshStandardMaterial({ color: 0x444444, roughness: 0.35, metalness: 0.2 })
  const cofferMat = new MeshStandardMaterial({ color: 0xf0f2f5, roughness: 0.95, metalness: 0.0 })
  const cofferInsetMat = new MeshStandardMaterial({ color: 0xe7eaee, roughness: 1.0, metalness: 0.0 })
  

  // -----------------------------
  // Single floor covering everything
  // -----------------------------
  const floor = new Mesh(new PlaneGeometry(SIZE_X, SIZE_Z), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((MIN_X + MAX_X)/2, 0, (MIN_Z + MAX_Z)/2);
  floor.receiveShadow = true;
  scene.add(floor);

  // Constants for decor
  const BASEBOARD_H = 0.16
  const BASEBOARD_T = 0.04
  const RAIL_H      = 2.15  // height of picture rail
  const RAIL_T      = 0.03
  const RAIL_W      = 0.06
  const SCONCE_SPACING = 6.0
  const SCONCE_OFF    = 0.08 // how far out from wall

  type SegX = Extract<WallSeg,{kind:'X'}>;
  type SegZ = Extract<WallSeg,{kind:'Z'}>;

  // Collect all repeated geometry transforms; flush to InstancedMesh after scene is built.
  const cofferBeamInstances: Array<{px:number;py:number;pz:number;sx:number;sy:number;sz:number}> = [];
  // Collect trim transforms; flush to InstancedMesh after all walls are built.
  // Each entry: { px, py, pz, sx, sy, sz } — position + scale (rotation always 0)
  const trimInstances:  Array<{px:number;py:number;pz:number;sx:number;sy:number;sz:number}> = [];
  const railInstances:  Array<{px:number;py:number;pz:number;sx:number;sy:number;sz:number}> = [];
  const sconceInstances:Array<{px:number;py:number;pz:number;sx:number;sy:number;sz:number}> = [];

  function addTrimForSegX(seg: SegX) {
    const len = seg.x1 - seg.x0;
    const cx  = (seg.x0+seg.x1)/2;
    trimInstances.push({ px: cx, py: BASEBOARD_H/2,  pz: seg.z + (seg.nZ>0?BASEBOARD_T/2:-BASEBOARD_T/2), sx: len, sy: BASEBOARD_H, sz: BASEBOARD_T });
    railInstances.push({ px: cx, py: RAIL_H,          pz: seg.z + (seg.nZ>0?RAIL_T/2:-RAIL_T/2),           sx: len, sy: RAIL_W,      sz: RAIL_T      });
  }

  function addTrimForSegZ(seg: SegZ) {
    const len = seg.z1 - seg.z0;
    const cz  = (seg.z0+seg.z1)/2;
    trimInstances.push({ px: seg.x + (seg.nX>0?BASEBOARD_T/2:-BASEBOARD_T/2), py: BASEBOARD_H/2, pz: cz, sx: BASEBOARD_T, sy: BASEBOARD_H, sz: len });
    railInstances.push({ px: seg.x + (seg.nX>0?RAIL_T/2:-RAIL_T/2),           py: RAIL_H,        pz: cz, sx: RAIL_T,      sy: RAIL_W,      sz: len });
  }

  /** Build one InstancedMesh from a list of axis-aligned box transforms */
  function flushBoxInstances(
    instances: Array<{px:number;py:number;pz:number;sx:number;sy:number;sz:number}>,
    mat: THREE.Material
  ) {
    if (instances.length === 0) return;
    // Use a 1×1×1 box; scale each instance to the right size via matrix
    const geo  = new BoxGeometry(1, 1, 1);
    const mesh = new InstancedMesh(geo, mat, instances.length);
    mesh.castShadow   = false;
    mesh.receiveShadow = false;
    const m = new Matrix4();
    instances.forEach((inst, i) => {
      m.makeScale(inst.sx, inst.sy, inst.sz);
      m.setPosition(inst.px, inst.py, inst.pz);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }

  function addSconcesForSegX(seg: SegX) {
    const len = seg.x1 - seg.x0
    if (len < 3.0) return
    const count = Math.max(1, Math.floor(len / SCONCE_SPACING))
    for (let i=0;i<count;i++){
      const t = (count===1)?0.5:(i+1)/(count+1)
      const x = seg.x0 + t*len
      const z = seg.z + (seg.nZ>0 ? SCONCE_OFF : -SCONCE_OFF)
      sconceInstances.push({ px: x, py: 2.05, pz: z, sx: 0.18, sy: 0.28, sz: 0.06 });
      const lamp = new PointLight(0xfff5e0, 0.5, 6.0, 2.0)
      lamp.position.set(x, 2.1, seg.z + (seg.nZ>0 ? 0.15 : -0.15))
      scene.add(lamp)
    }
  }

  function addSconcesForSegZ(seg: SegZ) {
    const len = seg.z1 - seg.z0
    if (len < 3.0) return
    const count = Math.max(1, Math.floor(len / SCONCE_SPACING))
    for (let i=0;i<count;i++){
      const t = (count===1)?0.5:(i+1)/(count+1)
      const z = seg.z0 + t*len
      const x = seg.x + (seg.nX>0 ? SCONCE_OFF : -SCONCE_OFF)
      sconceInstances.push({ px: x, py: 2.05, pz: z, sx: 0.06, sy: 0.28, sz: 0.18 });
      const lamp = new PointLight(0xfff5e0, 0.5, 6.0, 2.0)
      lamp.position.set(seg.x + (seg.nX>0 ? 0.15 : -0.15), 2.1, z)
      scene.add(lamp)
    }
  }

  function addCofferedCeiling(rect:{x0:number;x1:number;z0:number;z1:number}) {
    const width  = rect.x1-rect.x0
    const depth  = rect.z1-rect.z0
    const nx = Math.max(2, Math.floor(width / 6))   // number of coffers across
    const nz = Math.max(2, Math.floor(depth / 6))
    const gap = 0.15
    const beamT = 0.06

    for (let ix=0; ix<nx; ix++){
      for (let iz=0; iz<nz; iz++){
        const x0 = rect.x0 + (ix+0)*width/nx + gap
        const x1 = rect.x0 + (ix+1)*width/nx - gap
        const z0 = rect.z0 + (iz+0)*depth/nz + gap
        const z1 = rect.z0 + (iz+1)*depth/nz - gap
        const cx = (x0+x1)/2, cz=(z0+z1)/2
        const w = x1-x0, d = z1-z0

        // Collect coffer beam instances instead of individual Meshes
        cofferBeamInstances.push(
          { px: cx, py: H - beamT/2, pz: z0, sx: w,     sy: beamT, sz: beamT },
          { px: cx, py: H - beamT/2, pz: z1, sx: w,     sy: beamT, sz: beamT },
          { px: x0, py: H - beamT/2, pz: cz, sx: beamT, sy: beamT, sz: d     },
          { px: x1, py: H - beamT/2, pz: cz, sx: beamT, sy: beamT, sz: d     }
        );
        // inset panel (one mesh per panel is fine — PlaneGeometry is very cheap)
        const inset = new Mesh(new PlaneGeometry(w-0.06, d-0.06), cofferInsetMat)
        inset.rotation.x = Math.PI/2
        inset.position.set(cx, H - 0.09, cz)
        scene.add(inset)
      }
    }
  }

  /** Add two horizontal strips (picture rail near the top and chair rail mid-wall)
   *  on the *interior* face of a wall segment.
   *  axis: 'X'  → wall runs along X (faces +/-Z)
   *        'Z'  → wall runs along Z (faces +/-X)
   */
  // addWallStrips: feeds instance arrays instead of creating individual Meshes
  function addWallStrips(
    _scene: THREE.Scene,
    axis: 'X' | 'Z',
    len: number,
    faceNormal: 1 | -1,
    center: THREE.Vector3,
    H: number,
    WALL_T: number
  ) {
    const stripH   = 0.06;
    const protrude = 0.012;
    const yPicture = H - 0.22;
    const yChair   = 1.10;

    const pushStrip = (
      y: number,
      arr: Array<{px:number;py:number;pz:number;sx:number;sy:number;sz:number}>
    ) => {
      if (axis === 'X') {
        arr.push({ px: center.x, py: y,
          pz: center.z + faceNormal * (WALL_T/2 + protrude/2),
          sx: len, sy: stripH, sz: WALL_T + protrude*2 });
      } else {
        arr.push({ px: center.x + faceNormal * (WALL_T/2 + protrude/2), py: y,
          pz: center.z,
          sx: WALL_T + protrude*2, sy: stripH, sz: len });
      }
    };

    pushStrip(yPicture, trimInstances);
    pushStrip(yChair,   railInstances);
  }

  // -----------------------------
  // Helpers to add mesh walls and record colliders & hangable segments
  // -----------------------------
  const colliders: RectXZ[] = [];
  const segs: WallSeg[] = [];

  const addWallX = (
    z: number,
    x0: number,
    x1: number,
    normalToward: 1 | -1,
    leaveDoorAt?: number
  ) => {
    const len = x1 - x0;
    if (leaveDoorAt !== undefined) {
      const d0 = leaveDoorAt - DOOR_W/2;
      const d1 = leaveDoorAt + DOOR_W/2;
      if (d0 > x0 + 0.01) addWallX(z, x0, d0, normalToward);
      if (x1 > d1 + 0.01) addWallX(z, d1, x1, normalToward);
      return;
    }

    const cx = (x0 + x1) / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(len, H, WALL_T), wallMat);
    wall.position.set(cx, H/2, z + (WALL_T/2) * normalToward);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    // add decor strips on the interior face
    addWallStrips(
      scene,
      'X',
      len,
      normalToward,
      new THREE.Vector3(cx, H/2, z),
      H,
      WALL_T
    );

    // collider (unchanged)
    colliders.push({
      minX: cx - len/2,
      maxX: cx + len/2,
      minZ: z + (normalToward > 0 ? 0 : -WALL_T),
      maxZ: z + (normalToward > 0 ? WALL_T : 0),
    });

    // hangable segment (unchanged)
    segs.push({ kind: 'X', z: z + normalToward * (WALL_T/2), x0, x1, nZ: normalToward });
  };


  const addWallZ = (
    x: number,
    z0: number,
    z1: number,
    normalToward: 1 | -1,
    leaveDoorAt?: number
  ) => {
    const len = z1 - z0;
    if (leaveDoorAt !== undefined) {
      const d0 = leaveDoorAt - DOOR_W/2;
      const d1 = leaveDoorAt + DOOR_W/2;
      if (d0 > z0 + 0.01) addWallZ(x, z0, d0, normalToward);
      if (z1 > d1 + 0.01) addWallZ(x, d1, z1, normalToward);
      return;
    }

    const cz = (z0 + z1) / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, H, len), wallMat);
    wall.position.set(x + (WALL_T/2) * normalToward, H/2, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    // add decor strips on the interior face
    addWallStrips(
      scene,
      'Z',
      len,
      normalToward,
      new THREE.Vector3(x, H/2, cz),
      H,
      WALL_T
    );

    // collider (unchanged)
    colliders.push({
      minX: x + (normalToward > 0 ? 0 : -WALL_T),
      maxX: x + (normalToward > 0 ? WALL_T : 0),
      minZ: cz - len/2,
      maxZ: cz + len/2,
    });

    // hangable segment (unchanged)
    segs.push({ kind: 'Z', x: x + normalToward * (WALL_T/2), z0, z1, nX: normalToward });
  };

  const addCeilingForRect = (r: {x0:number;x1:number;z0:number;z1:number}) => {
    const c = new Mesh(new PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), ceilMat);
    c.rotation.x = Math.PI/2;
    c.position.set((r.x0+r.x1)/2, H, (r.z0+r.z1)/2);
    scene.add(c);
  };


  // -----------------------------
  // Build rooms with doorways and dividers
  // -----------------------------
  // Atrium outer
  addWallX(R_ATRIUM.z0, R_ATRIUM.x0, R_ATRIUM.x1, +1, 0);                   // south, doorway center 0
  addWallX(R_ATRIUM.z1, R_ATRIUM.x0, R_ATRIUM.x1, -1, 0);                   // north, doorway to North gallery
  addWallZ(R_ATRIUM.x0, R_ATRIUM.z0, R_ATRIUM.z1, +1, 0);                   // west, doorway to West
  addWallZ(R_ATRIUM.x1, R_ATRIUM.z0, R_ATRIUM.z1, -1, 0);                   // east, doorway to East

  // Atrium internal dividers (islands / corridor cuts)
  addWallX((R_ATRIUM.z0+R_ATRIUM.z1)/2 - 2.0, R_ATRIUM.x0+2, R_ATRIUM.x1-2, +1); // mid-span
  addWallZ((R_ATRIUM.x0+R_ATRIUM.x1)/2 - 4.0, R_ATRIUM.z0+2, R_ATRIUM.z1-2, +1); // cross

  addCeilingForRect(R_ATRIUM);

  // North gallery (front)
  addWallX(R_NORTH.z0, R_NORTH.x0, R_NORTH.x1, +1, 0);          // connects back to atrium
  addWallX(R_NORTH.z1, R_NORTH.x0, R_NORTH.x1, -1);             // far end
  addWallZ(R_NORTH.x0, R_NORTH.z0, R_NORTH.z1, +1);             // west
  addWallZ(R_NORTH.x1, R_NORTH.z0, R_NORTH.z1, -1);             // east
  // two small zig-zag dividers inside North
  addWallX(R_NORTH.z0 + 4.0, R_NORTH.x0 + 2.0, R_NORTH.x1 - 6.0, +1);
  addWallZ(R_NORTH.x1 - 6.0, R_NORTH.z0 + 4.0, R_NORTH.z1 - 2.0, -1);

  addCeilingForRect(R_NORTH);

  // East gallery (right)
  addWallZ(R_EAST.x0, R_EAST.z0, R_EAST.z1, +1, 0);             // connects back to atrium
  addWallZ(R_EAST.x1, R_EAST.z0, R_EAST.z1, -1);                // far end
  addWallX(R_EAST.z0, R_EAST.x0, R_EAST.x1, +1);
  addWallX(R_EAST.z1, R_EAST.x0, R_EAST.x1, -1);
  // short divider
  addWallX((R_EAST.z0+R_EAST.z1)/2, R_EAST.x0 + 2.0, R_EAST.x1 - 2.0, +1);

  addCeilingForRect(R_EAST);

  // West gallery (left)
  addWallZ(R_WEST.x1, R_WEST.z0, R_WEST.z1, -1, 0);             // connects back to atrium
  addWallZ(R_WEST.x0, R_WEST.z0, R_WEST.z1, +1);                // far end
  addWallX(R_WEST.z0, R_WEST.x0, R_WEST.x1, +1);
  addWallX(R_WEST.z1, R_WEST.x0, R_WEST.x1, -1);
  // two little islands
  addWallZ((R_WEST.x0+R_WEST.x1)/2, R_WEST.z0+2.0, R_WEST.z1-2.0, +1);
  addWallX((R_WEST.z0+R_WEST.z1)/2 - 2.0, R_WEST.x0+2.0, R_WEST.x1-2.0, +1);

  addCeilingForRect(R_WEST);

  addCofferedCeiling(R_ATRIUM)
  addCofferedCeiling(R_NORTH)
  addCofferedCeiling(R_EAST)
  addCofferedCeiling(R_WEST)

  // -----------------------------
  // Section rectangles (centers used for statues)
  // Match your own divider positions from above
  // -----------------------------
  const sections: Array<{x0:number;x1:number;z0:number;z1:number}> = [];

  // === Atrium split by the two dividers you already add ===
  const ATR_MID_Z = (R_ATRIUM.z0 + R_ATRIUM.z1) / 2 - 2.0;
  const ATR_MID_X = (R_ATRIUM.x0 + R_ATRIUM.x1) / 2 - 4.0;
  sections.push(
    { x0: R_ATRIUM.x0, x1: ATR_MID_X, z0: R_ATRIUM.z0, z1: ATR_MID_Z }, // SW
    { x0: ATR_MID_X,   x1: R_ATRIUM.x1, z0: R_ATRIUM.z0, z1: ATR_MID_Z }, // SE
    { x0: R_ATRIUM.x0, x1: ATR_MID_X, z0: ATR_MID_Z,     z1: R_ATRIUM.z1 }, // NW
    { x0: ATR_MID_X,   x1: R_ATRIUM.x1, z0: ATR_MID_Z,   z1: R_ATRIUM.z1 }  // NE
  );

  // === North gallery: you added a horizontal (z0+4) and a vertical (x1-6) divider ===
  const N_DIV_Z = R_NORTH.z0 + 4.0;
  const N_DIV_X = R_NORTH.x1 - 6.0;
  sections.push(
    { x0: R_NORTH.x0, x1: N_DIV_X, z0: R_NORTH.z0, z1: N_DIV_Z },   // near-left
    { x0: N_DIV_X,   x1: R_NORTH.x1, z0: R_NORTH.z0, z1: R_NORTH.z1 }, // right strip
    { x0: R_NORTH.x0, x1: N_DIV_X, z0: N_DIV_Z, z1: R_NORTH.z1 }    // far-left
  );

  // === East gallery: single horizontal divider at mid z ===
  const E_MID_Z = (R_EAST.z0 + R_EAST.z1) * 0.5;
  sections.push(
    { x0: R_EAST.x0, x1: R_EAST.x1, z0: R_EAST.z0, z1: E_MID_Z },
    { x0: R_EAST.x0, x1: R_EAST.x1, z0: E_MID_Z,   z1: R_EAST.z1 }
  );

  // === West gallery: one central vertical + one horizontal divider ===
  const W_MID_X = (R_WEST.x0 + R_WEST.x1) * 0.5;
  const W_MID_Z = (R_WEST.z0 + R_WEST.z1) * 0.5;
  sections.push(
    { x0: R_WEST.x0, x1: W_MID_X, z0: R_WEST.z0, z1: W_MID_Z },
    { x0: W_MID_X,   x1: R_WEST.x1, z0: R_WEST.z0, z1: W_MID_Z },
    { x0: R_WEST.x0, x1: R_WEST.x1, z0: W_MID_Z,   z1: R_WEST.z1 }
  );

  // Proximity points for plaque + minimap (populated by statue loader & frame hangers)
  const proximityPoints: ProximityPoint[] = [];

  // Statue spotlights — collected here so main.ts can lerp them for day/night
  const statueLights: SpotLight[] = [];

  // Place statues at those section centers (async, no need to await)
  void addStatuesAtSectionCenters(scene, sections, proximityPoints, statueLights);


  // -----------------------------
  // Lighting (day mode defaults)
  // -----------------------------
  const amb  = new AmbientLight(0xffffff, 0.65);
  const hemi = new HemisphereLight(0xffffff, 0xd1d5db, 0.85);
  const sun  = new DirectionalLight(0xffffff, 0.75);
  sun.position.set(6, H, 2);
  sun.castShadow = true;
  scene.add(amb, hemi, sun, sun.target);

  // 4 warm painting-wash PointLights — one per room, at picture-rail height.
  // Covers all frames in a room without needing one light per frame.
  // Intensity 0 in day (ambient is enough), ramped up in night mode.
  const roomCentres = [
    { x: (R_ATRIUM.x0+R_ATRIUM.x1)/2, z: (R_ATRIUM.z0+R_ATRIUM.z1)/2 },
    { x: (R_NORTH.x0 +R_NORTH.x1) /2, z: (R_NORTH.z0 +R_NORTH.z1) /2 },
    { x: (R_EAST.x0  +R_EAST.x1)  /2, z: (R_EAST.z0  +R_EAST.z1)  /2 },
    { x: (R_WEST.x0  +R_WEST.x1)  /2, z: (R_WEST.z0  +R_WEST.z1)  /2 },
  ];
  const pictureWashLights: PointLight[] = roomCentres.map(rc => {
    const pl = new PointLight(0xfff0cc, 0.0, 28, 1.5);
    pl.position.set(rc.x, 2.2, rc.z);
    scene.add(pl);
    return pl;
  });

  // Single warm candle-tone fill for night atmosphere
  const nightFill = new PointLight(0xff9944, 0.0, 60);
  nightFill.position.set(0, H * 0.6, 0);
  scene.add(nightFill);

  // -----------------------------
  // Painting placement (fills every wall segment)
  // -----------------------------
  const frames: ArtworkMeta[] = [...opts.artworks]; // copy
  let idx = 0;

  const hangOnSegX = (seg: Extract<WallSeg, {kind:'X'}>) => {
    const usable = (seg.x1 - seg.x0) - 2 * (CAP_MARGIN + HALF_W);
    if (usable <= 0) return;

    const count = Math.floor(usable / SPACING) + 1;
    const startX = seg.x0 + CAP_MARGIN + HALF_W;
    const endX   = seg.x1 - CAP_MARGIN - HALF_W;

    for (let i = 0; i < count && idx < frames.length; i++) {
      const t = (count === 1) ? 0.5 : i / (count - 1);
      const x = startX + t * (endX - startX);
      const z = seg.z + (seg.nZ > 0 ?  WALL_GAP : -WALL_GAP);

      // ---- Corner collision check ----
      const hitWall = segs.some((other) => {
        if (other.kind === 'Z') {
          const nearX = Math.abs(other.x - x) < HALF_W + 0.05;
          const insideZ = z >= other.z0 - 0.05 && z <= other.z1 + 0.05;
          return nearX && insideZ;
        }
        return false;
      });
      if (hitWall) continue;
      // --------------------------------

      const meta = frames[idx++];
      const f = new Frame(meta, `${opts.imagesBase}/${meta.file}`, FRAME_W);
      f.position.set(x, 1.6, z);
      f.rotation.y = (seg.nZ > 0) ? 0 : Math.PI;
      scene.add(f);

      proximityPoints.push({
        x, z,
        label: meta.title || meta.file,
        sublabel: meta.author,
        kind: 'artwork',
      });
    }
  };

  const hangOnSegZ = (seg: Extract<WallSeg, {kind:'Z'}>) => {
    const usable = (seg.z1 - seg.z0) - 2 * (CAP_MARGIN + HALF_W);
    if (usable <= 0) return;

    const count = Math.floor(usable / SPACING) + 1;
    const startZ = seg.z0 + CAP_MARGIN + HALF_W;
    const endZ   = seg.z1 - CAP_MARGIN - HALF_W;

    for (let i = 0; i < count && idx < frames.length; i++) {
      const t = (count === 1) ? 0.5 : i / (count - 1);
      const z = startZ + t * (endZ - startZ);
      const x = seg.x + (seg.nX > 0 ?  WALL_GAP : -WALL_GAP);

      // ---- Corner collision check ----
      const hitWall = segs.some((other) => {
        if (other.kind === 'X') {
          const nearZ = Math.abs(other.z - z) < HALF_W + 0.05;
          const insideX = x >= other.x0 - 0.05 && x <= other.x1 + 0.05;
          return nearZ && insideX;
        }
        return false;
      });
      if (hitWall) continue;
      // --------------------------------

      const meta = frames[idx++];
      const f = new Frame(meta, `${opts.imagesBase}/${meta.file}`, FRAME_W);
      f.position.set(x, 1.6, z);
      f.rotation.y = (seg.nX > 0) ? Math.PI/2 : -Math.PI/2;
      scene.add(f);

      proximityPoints.push({
        x, z,
        label: meta.title || meta.file,
        sublabel: meta.author,
        kind: 'artwork',
      });
    }
  };

  // Already appended in “room construction” order; just iterate
  for (const seg of segs) {
    if (idx >= frames.length) break;
    if (seg.kind === 'X') hangOnSegX(seg); else hangOnSegZ(seg);
  }

  // -----------------------------
  // Bounds (keep player inside)
  // -----------------------------
  const bounds: Bounds = {
    minX: MIN_X + 0.6,
    maxX: MAX_X - 0.6,
    minY: 0.9,
    maxY: H - 0.4,
    minZ: MIN_Z + 0.6,
    maxZ: MAX_Z - 0.6,
  };

  const suggestedSpawn = new Vector3((R_ATRIUM.x0+R_ATRIUM.x1)/2 - 6, 1.6, (R_ATRIUM.z0+R_ATRIUM.z1)/2);

  // ── Flush all instanced geometry (trim, rails, sconce backs, coffer beams) ──
  // All walls, ceilings and trim loops are finished — build the InstancedMeshes now.
  for (const seg of segs) {
    if (seg.kind === 'X') { addTrimForSegX(seg as SegX); addSconcesForSegX(seg as SegX); }
    else                  { addTrimForSegZ(seg as SegZ); addSconcesForSegZ(seg as SegZ); }
  }
  flushBoxInstances(trimInstances,        trimMat);
  flushBoxInstances(railInstances,        railMat);
  flushBoxInstances(sconceInstances,      sconceMat);
  flushBoxInstances(cofferBeamInstances,  cofferMat);

  // Room rectangles for minimap rendering
  const rooms = [R_ATRIUM, R_NORTH, R_EAST, R_WEST];

  // Expose lighting + scene refs so main.ts can drive the day/night toggle
  const lightingRefs = { scene, amb, hemi, sun, nightFill, statueLights, pictureWashLights };

  // Your code adds objects directly to `scene`, so we return an empty Group for API parity.
  return { root: new Group(), suggestedSpawn, bounds, colliders, proximityPoints, rooms, lightingRefs };
}