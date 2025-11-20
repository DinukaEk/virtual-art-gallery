import {
  Scene, PerspectiveCamera, WebGLRenderer, SRGBColorSpace,
  ACESFilmicToneMapping, PCFSoftShadowMap
} from 'three';
import { createControls } from './controls';
import { buildGallery } from './gallery';
import type { ArtworkMeta } from './types';

async function fetchMetadata(): Promise<ArtworkMeta[]> {
  const url = `${import.meta.env.BASE_URL}metadata.json`;
  const r = await fetch(url);
  return r.ok ? r.json() : [];
}

const BASE = import.meta.env.BASE_URL;


async function start() {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 400);

  const artworks = await fetchMetadata();
  const imagesBase = `${import.meta.env.BASE_URL}images`;
  const { root, suggestedSpawn, bounds, colliders } = buildGallery(scene, { imagesBase, artworks });
  camera.position.copy(suggestedSpawn);

  const { update, setBounds, setColliders } = createControls(camera, renderer.domElement, bounds, colliders);
  setBounds(bounds);
  setColliders(colliders);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  let last = performance.now();
  const loop = (now:number) => {
    const dt = Math.min((now - last)/1000, 0.05); last = now;
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
start();