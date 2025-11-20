export type ArtworkMeta = {
  file: string;
  title?: string;
  author?: string;
  year?: string;
  description?: string;
};

export type Bounds = {
  minX: number; maxX: number;
  minY: number; maxY: number;
  minZ: number; maxZ: number;
};

/** Axis-aligned wall collider (X/Z plane) */
export type RectXZ = {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
};