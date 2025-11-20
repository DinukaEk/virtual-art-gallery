import { defineConfig } from 'vite';

export default defineConfig({
  base: '/virtual-art-gallery/',
  assetsInclude: ["**/*.obj", "**/*.mtl", "**/*.glb", "**/*.gltf", "**/*.hdr", "**/*.exr"],
});
