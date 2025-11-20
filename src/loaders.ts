import * as THREE from 'three'

export function loadArtTextures(max = 200) {
  const loader = new THREE.TextureLoader()
  const textures: { texture: THREE.Texture; title: string }[] = []

  for (let i = 1; i <= max; i++) {
    const n2 = String(i).padStart(2, '0')
    const paths = [`/images/${n2}.jpg`, `/images/${i}.jpg`, `/images/${n2}.png`, `/images/${i}.png`]
    for (const p of paths) {
      const tex = loader.load(p)
      if (tex.image) {
        tex.colorSpace = THREE.SRGBColorSpace
        const name = p.split('/').pop()!.split('.')[0]
        textures.push({ texture: tex, title: name })
        break
      }
    }
  }
  return textures
}