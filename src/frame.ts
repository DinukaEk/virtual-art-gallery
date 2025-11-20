import {
  Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, BoxGeometry, TextureLoader, SRGBColorSpace, Texture, CanvasTexture
} from 'three';
import type { ArtworkMeta } from './types';

const loader = new TextureLoader();

function fallbackTexture(label: string): Texture {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e2e6ed'; g.fillRect(0,0,512,512);
  g.fillStyle = '#445'; g.font = 'bold 36px system-ui, Arial';
  g.fillText('IMAGE MISSING', 80, 260);
  return new CanvasTexture(c);
}

function captionTexture(text: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 200;
  const g = c.getContext('2d')!;
  g.clearRect(0,0,c.width,c.height);
  g.fillStyle = 'rgba(0,0,0,0.9)';
  g.font = '600 60px system-ui, Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width/2, c.height/2);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export class Frame extends Group {
  public imageMesh: Mesh;
  public captionMesh: Mesh;

  constructor(meta: ArtworkMeta, imageUrl: string, width = 1.8) {
    super();

    const frameDepth = 0.05;
    const imgH = width * 0.66;

    const bezel = new Mesh(
      new BoxGeometry(width + 0.12, imgH + 0.12, frameDepth),
      new MeshStandardMaterial({ color: 0x4b372a, roughness: 0.7, metalness: 0.1 })
    );
    bezel.castShadow = true; bezel.receiveShadow = true;
    this.add(bezel);

    const imgMat = new MeshBasicMaterial({ map: new CanvasTexture(document.createElement('canvas')) });
    const picture = new Mesh(new PlaneGeometry(width, imgH), imgMat);
    picture.position.z = frameDepth * 0.5 + 0.0025;
    this.add(picture);
    this.imageMesh = picture;

    // centered caption, directly under picture (same Z plane)
    const label = [meta.title, meta.author].filter(Boolean).join(' – ') || meta.file;
    const capTex = captionTexture(label);
    const capMat = new MeshBasicMaterial({ map: capTex, transparent: true });
    const capH = 0.20;
    const caption = new Mesh(new PlaneGeometry(width, capH), capMat);
    caption.position.set(0, -imgH/2 - capH/2 - 0.06, picture.position.z + 0.001);
    caption.renderOrder = 2;
    this.add(caption);
    this.captionMesh = caption;

    // async image
    loader.setCrossOrigin('anonymous');
    loader.load(
      imageUrl,
      (t) => { t.colorSpace = SRGBColorSpace; imgMat.map = t; imgMat.needsUpdate = true; },
      undefined,
      (e) => console.warn('Failed to load', imageUrl, e)
    );
  }
}