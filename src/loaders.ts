import * as THREE from 'three';

/**
 * Attempt to load artwork textures from sequentially-numbered image files.
 *
 * FIX: The original version checked `tex.image` immediately after `loader.load()`,
 * which is always `undefined` because texture loading is asynchronous.
 * The corrected version uses the onLoad callback to confirm the image actually
 * exists before adding it to the results.
 *
 * @param max   Maximum image index to attempt (default 200)
 * @param base  Base URL prefix for image paths (default '')
 * @returns     Promise resolving to an array of successfully-loaded textures
 */
export function loadArtTextures(
  max = 200,
  base = ''
): Promise<{ texture: THREE.Texture; title: string }[]> {
  const loader = new THREE.TextureLoader();
  const results: { texture: THREE.Texture; title: string }[] = [];

  // Try all candidate paths for index i; resolve with the first that loads.
  const tryIndex = (i: number): Promise<void> => {
    const n2 = String(i).padStart(2, '0');
    const paths = [
      `${base}/images/${n2}.jpg`,
      `${base}/images/${i}.jpg`,
      `${base}/images/${n2}.png`,
      `${base}/images/${i}.png`,
    ];

    // Try each path in sequence; stop at first success.
    const tryPath = (idx: number): Promise<void> => {
      if (idx >= paths.length) return Promise.resolve(); // none worked — skip
      const p = paths[idx];
      return new Promise<void>((resolve) => {
        loader.load(
          p,
          (tex) => {
            // onLoad: image actually exists
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter  = THREE.LinearMipmapLinearFilter;
            const title = p.split('/').pop()!.replace(/\.[^.]+$/, '');
            results.push({ texture: tex, title });
            resolve();
          },
          undefined,
          () => {
            // onError: this path failed — try next candidate
            tryPath(idx + 1).then(resolve);
          }
        );
      });
    };

    return tryPath(0);
  };

  // Load all indices sequentially to avoid hammering the network.
  // Switch to Promise.all(indices.map(tryIndex)) for parallel loading if desired.
  return (async () => {
    for (let i = 1; i <= max; i++) {
      await tryIndex(i);
    }
    return results;
  })();
}