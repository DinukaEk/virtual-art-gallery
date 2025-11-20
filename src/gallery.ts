import * as THREE from 'three';
import {
  Scene, Group, Color, Vector3, Mesh,
  MeshStandardMaterial, AmbientLight, HemisphereLight, DirectionalLight,
  FogExp2, TextureLoader, RepeatWrapping, SRGBColorSpace,
  BoxGeometry, PlaneGeometry, DoubleSide,
  SphereGeometry, CylinderGeometry,
  Box3, Quaternion, SpotLight, PointLight
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
async function addStatuesAtSectionCenters(scene: Scene, sections: Array<{x0:number;x1:number;z0:number;z1:number}>) {
  const PACKS = [
    { base: `${BASE}models/statues/David/`, obj: '12330_Statue_v1_L2.obj', mtl: '12330_Statue_v1_L2.mtl', scale: 0.003 },
    { base: `${BASE}models/statues/Shiva/`, obj: '12337_Statue_v1_l1.obj', mtl: '12337_Statue_v1_l1.mtl', scale: 0.001 },
    { base: `${BASE}models/statues/The_Thinker/`, obj: '12335_The_Thinker_v3_l2.obj', mtl: '12335_The_Thinker_v3_l2.mtl', scale: 0.002 },
    { base: `${BASE}models/statues/Statue1/`, obj: '12328_Statue_v1_L2.obj', mtl: '12328_Statue_v1_L2.mtl', scale: 0.007 },
    { base: `${BASE}models/statues/Statue2/`, obj: '12338_Statue_v1_L3.obj', mtl: '12338_Statue_v1_L3.mtl', scale: 0.006 },
    { base: `${BASE}models/statues/EgyptianPharaoh/`, obj: '15778_NoveltyBust_EgyptianPharaoh_V1_NEW.obj', mtl: 'blank.mtl', scale: 0.02 },
    { base: `${BASE}models/statues/buddah/`, obj: '12334_statue_v1_l3.obj', mtl: '12334_statue_v1_l3.mtl', scale: 0.002 },
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
      
      // 0) start from a clean orientation
      statue.rotation.set(0, 0, 0);

      // 1) measure current extents to see which axis is the long one
      const bbox0 = new Box3().setFromObject(statue);
      const size0 = new Vector3();
      bbox0.getSize(size0);

      // 2) rotate that long axis to +Y:
      //    - if X is longest, it's “lying along X”: rotate +90° around Z
      //    - if Z is longest, it's “lying along Z”: rotate -90° around X
      //    - if Y is already longest, do nothing
      if (size0.x >= size0.y && size0.x >= size0.z) {
        statue.rotateZ(Math.PI / 2);
      } else if (size0.z >= size0.x && size0.z >= size0.y) {
        statue.rotateX(-Math.PI / 2);
      }

      // 3) scale, then seat the base on the pedestal top (y=0.8)
      statue.scale.setScalar(pack.scale);
      statue.updateMatrixWorld(true);

      const bbox = new Box3().setFromObject(statue);
      const lift = 0.8 - bbox.min.y; // 0.8 = pedestal top in your scene
      statue.position.set(cx, lift, cz);

      // 4) (optional) small yaw only, to avoid leaning
      statue.rotation.y = (i % 2 === 0) ? Math.PI * 0.2 : -Math.PI * 0.2;

      // finally:
      scene.add(statue);
    } catch {
      const fallback = makeAbstractStatue();
      fallback.position.set(cx, 0, cz);
      scene.add(fallback);
    }
  }
}

type BuildOpts = { imagesBase: string; artworks: ArtworkMeta[] };

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

  const floorTex =
    tex.load(`${BASE}textures/floor.jpg`, undefined, undefined, () => tex.load(`${BASE}textures/floor.png`));
  floorTex.wrapS = floorTex.wrapT = RepeatWrapping;
  floorTex.colorSpace = SRGBColorSpace;
  floorTex.repeat.set(Math.ceil(SIZE_X / 4), Math.ceil(SIZE_Z / 4));

  const wallTex =
    tex.load(`${BASE}textures/wall.jpg`, undefined, undefined, () => tex.load(`${BASE}textures/wall.png`));
  wallTex.wrapS = wallTex.wrapT = RepeatWrapping;
  wallTex.colorSpace = SRGBColorSpace;
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

  function addTrimForSegX(seg: SegX) {
    const len = seg.x1 - seg.x0
    // baseboard
    const base = new Mesh(new BoxGeometry(len, BASEBOARD_H, BASEBOARD_T), trimMat)
    base.position.set((seg.x0+seg.x1)/2, BASEBOARD_H/2, seg.z + (seg.nZ>0 ? BASEBOARD_T/2 : -BASEBOARD_T/2))
    scene.add(base)
    // picture rail
    const rail = new Mesh(new BoxGeometry(len, RAIL_W, RAIL_T), railMat)
    rail.position.set((seg.x0+seg.x1)/2, RAIL_H, seg.z + (seg.nZ>0 ? RAIL_T/2 : -RAIL_T/2))
    scene.add(rail)
  }

  function addTrimForSegZ(seg: SegZ) {
    const len = seg.z1 - seg.z0
    // baseboard
    const base = new Mesh(new BoxGeometry(BASEBOARD_T, BASEBOARD_H, len), trimMat)
    base.position.set(seg.x + (seg.nX>0 ? BASEBOARD_T/2 : -BASEBOARD_T/2), BASEBOARD_H/2, (seg.z0+seg.z1)/2)
    scene.add(base)
    // picture rail
    const rail = new Mesh(new BoxGeometry(RAIL_T, RAIL_W, len), railMat)
    rail.position.set(seg.x + (seg.nX>0 ? RAIL_T/2 : -RAIL_T/2), RAIL_H, (seg.z0+seg.z1)/2)
    scene.add(rail)
  }

  function addSconcesForSegX(seg: SegX) {
    const len = seg.x1 - seg.x0
    if (len < 3.0) return
    const count = Math.max(1, Math.floor(len / SCONCE_SPACING))
    for (let i=0;i<count;i++){
      const t = (count===1)?0.5:(i+1)/(count+1)
      const x = seg.x0 + t*len
      const z = seg.z + (seg.nZ>0 ? SCONCE_OFF : -SCONCE_OFF)
      const back = new Mesh(new BoxGeometry(0.18,0.28,0.06), sconceMat)
      back.position.set(x, 2.05, z)
      scene.add(back)
      const lamp = new SpotLight(0xffffff, 0.35, 5.5, Math.PI/6, 0.35)
      lamp.position.set(x, 2.05, seg.z + (seg.nZ>0 ? 0.25 : -0.25))
      lamp.target.position.set(x, 1.4, seg.z + (seg.nZ>0 ? -0.2 : 0.2)) // washes the wall
      scene.add(lamp, lamp.target)
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
      const back = new Mesh(new BoxGeometry(0.06,0.28,0.18), sconceMat)
      back.position.set(x, 2.05, z)
      scene.add(back)
      const lamp = new SpotLight(0xffffff, 0.35, 5.5, Math.PI/6, 0.35)
      lamp.position.set(seg.x + (seg.nX>0 ? 0.25 : -0.25), 2.05, z)
      lamp.target.position.set(seg.x + (seg.nX>0 ? -0.2 : 0.2), 1.4, z)
      scene.add(lamp, lamp.target)
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

        // border frame (four slim beams)
        const bx1 = new Mesh(new BoxGeometry(w, beamT, beamT), cofferMat)
        bx1.position.set(cx, H - beamT/2, z0)
        const bx2 = bx1.clone(); bx2.position.set(cx, H - beamT/2, z1)
        const bz1 = new Mesh(new BoxGeometry(beamT, beamT, d), cofferMat)
        bz1.position.set(x0, H - beamT/2, cz)
        const bz2 = bz1.clone(); bz2.position.set(x1, H - beamT/2, cz)
        scene.add(bx1,bx2,bz1,bz2)

        // inset panel (slightly lower)
        const inset = new Mesh(new PlaneGeometry(w-0.06, d-0.06), cofferInsetMat)
        inset.rotation.x = Math.PI/2
        inset.position.set(cx, H - 0.09, cz)
        scene.add(inset)

        // soft fill light (very subtle)
        const light = new PointLight(0xffffff, 0.06, Math.max(w,d)*2)
        light.position.set(cx, H - 0.25, cz)
        scene.add(light)
      }
    }
  }

  /** Add two horizontal strips (picture rail near the top and chair rail mid-wall)
   *  on the *interior* face of a wall segment.
   *  axis: 'X'  → wall runs along X (faces +/-Z)
   *        'Z'  → wall runs along Z (faces +/-X)
   */
  function addWallStrips(
    scene: THREE.Scene,
    axis: 'X' | 'Z',
    len: number,
    faceNormal: 1 | -1,
    center: THREE.Vector3,
    H: number,
    WALL_T: number
  ) {
    // visual sizes (kept very thin so they never collide with player or frames)
    const stripH  = 0.06;           // strip height
    const protrude = 0.012;         // 1.2 cm proud of wall plane (<< WALL_GAP)
    const yPicture = H - 0.22;      // picture rail just below ceiling
    const yChair   = 1.10;          // chair rail height

    const mkStrip = (y:number, mat:THREE.Material) => {
      let geo: THREE.BoxGeometry;
      if (axis === 'X') {
        geo = new THREE.BoxGeometry(len, stripH, WALL_T + protrude*2);
      } else {
        geo = new THREE.BoxGeometry(WALL_T + protrude*2, stripH, len);
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      // place the strip so it sits just slightly toward the room (avoid z-fighting)
      if (axis === 'X') {
        mesh.position.set(center.x, y, center.z + faceNormal * (WALL_T/2 + protrude/2));
      } else {
        mesh.position.set(center.x + faceNormal * (WALL_T/2 + protrude/2), y, center.z);
      }
      scene.add(mesh);
    };

    // Light/bright crown-like strip near top, darker chair rail mid-height
    mkStrip(yPicture, trimMat);
    mkStrip(yChair,   railMat);
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

  // --- helpers for statues (place near other helpers in gallery.ts) ---
  function addPlinthAndStatue(
    scene: Scene,
    colliders: RectXZ[],
    x: number,
    z: number,
    variant: number,
    H: number
  ) {
    // dimensions
    const PLINTH_W = 0.7;
    const PLINTH_H = 0.8;

    // pedestal
    const plinthGeo = new BoxGeometry(PLINTH_W, PLINTH_H, PLINTH_W);
    const plinthMat = new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.9, metalness: 0.0 });
    const plinth = new Mesh(plinthGeo, plinthMat);
    plinth.position.set(x, PLINTH_H / 2, z);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    scene.add(plinth);

    // collider so player can’t pass through the plinth
    colliders.push({
      minX: x - PLINTH_W / 2,
      maxX: x + PLINTH_W / 2,
      minZ: z - PLINTH_W / 2,
      maxZ: z + PLINTH_W / 2,
    });

    for (const seg of segs) {
      if (seg.kind === 'X') { addTrimForSegX(seg as SegX); addSconcesForSegX(seg as SegX); }
      else                  { addTrimForSegZ(seg as SegZ); addSconcesForSegZ(seg as SegZ); }
    }


    // statue material (warm marble)
    const marble = new MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.02 });

    // build a few “ancient bust” variants (pure primitives, no textures)
    const group = new Group();
    group.position.set(x, PLINTH_H, z);

    const addPart = (m: Mesh) => {
      m.castShadow = true;
      m.receiveShadow = false;
      group.add(m);
    };

    switch (variant % 4) {
      case 0: {
        // Stylized torso + neck + head
        const torso = new Mesh(new CylinderGeometry(0.22, 0.32, 0.42, 20), marble);
        torso.position.y = 0.21;
        addPart(torso);

        const neck = new Mesh(new CylinderGeometry(0.10, 0.12, 0.10, 16), marble);
        neck.position.y = 0.47;
        addPart(neck);

        const head = new Mesh(new SphereGeometry(0.18, 24, 16), marble);
        head.position.y = 0.67;
        addPart(head);
        break;
      }
      case 1: {
        // Abstract stacked forms
        const base = new Mesh(new BoxGeometry(0.36, 0.22, 0.24), marble);
        base.position.y = 0.11;
        addPart(base);

        const mid = new Mesh(new CylinderGeometry(0.18, 0.18, 0.22, 22), marble);
        mid.position.y = 0.33;
        addPart(mid);

        const top = new Mesh(new SphereGeometry(0.16, 24, 16), marble);
        top.position.y = 0.54;
        addPart(top);
        break;
      }
      case 2: {
        // Column fragment + relief
        const col = new Mesh(new CylinderGeometry(0.16, 0.16, 0.5, 24), marble);
        col.position.y = 0.25;
        addPart(col);

        const cap = new Mesh(new CylinderGeometry(0.20, 0.20, 0.06, 24), marble);
        cap.position.y = 0.53;
        addPart(cap);

        const disk = new Mesh(new CylinderGeometry(0.15, 0.15, 0.04, 24), marble);
        disk.rotation.x = Math.PI / 2;
        disk.position.y = 0.62;
        addPart(disk);
        break;
      }
      default: {
        // Minimal bust
        const chest = new Mesh(new BoxGeometry(0.32, 0.24, 0.18), marble);
        chest.position.y = 0.12;
        addPart(chest);

        const neck = new Mesh(new CylinderGeometry(0.10, 0.10, 0.10, 16), marble);
        neck.position.y = 0.28;
        addPart(neck);

        const head = new Mesh(new SphereGeometry(0.16, 24, 16), marble);
        head.position.y = 0.46;
        addPart(head);
        break;
      }
    }

    scene.add(group);
  }

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

  // Place statues at those section centers (async, no need to await)
  void addStatuesAtSectionCenters(scene, sections);


  // -----------------------------
  // Lighting (brighter for PBR)
  // -----------------------------
  const amb  = new AmbientLight(0xffffff, 0.65);
  const hemi = new HemisphereLight(0xffffff, 0xd1d5db, 0.85);
  const sun  = new DirectionalLight(0xffffff, 0.75);
  sun.position.set(6, H, 2);
  sun.castShadow = true;
  scene.add(amb, hemi, sun, sun.target);

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

  // Your code adds objects directly to `scene`, so we return an empty Group for API parity.
  return { root: new Group(), suggestedSpawn, bounds, colliders };
}