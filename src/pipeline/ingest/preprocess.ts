// Tiling plan for the LFM2.5-VL preprocessor contract.
//
// - images ≤ 512×512 pass through at native resolution (never upscaled)
// - larger images are split into a non-overlapping 512×512 grid plus one
//   downscaled thumbnail for global context
// - the grid is clamped to the device profile's maxTilesPerPage by downscaling
//   the page first
//
// planTiles is pure (dimensions in, plan out) so the geometry is unit-tested
// without any canvas. Bitmap extraction lives in `extractTiles` (browser-only).

export const TILE_SIZE = 512;
export const THUMBNAIL_MAX_EDGE = 512;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TilePlan {
  /** Scale applied to the source before tiling. Always ≤ 1 (no upscaling). */
  scale: number;
  scaledWidth: number;
  scaledHeight: number;
  grid: { rows: number; cols: number };
  tiles: Rect[];
  /** Downscaled whole-page thumbnail, or null when the image fits one tile. */
  thumbnail: Size | null;
}

export function computeGrid(width: number, height: number): { rows: number; cols: number } {
  return {
    cols: Math.max(1, Math.ceil(width / TILE_SIZE)),
    rows: Math.max(1, Math.ceil(height / TILE_SIZE)),
  };
}

function buildTiles(width: number, height: number): Rect[] {
  const tiles: Rect[] = [];
  for (let y = 0; y < height; y += TILE_SIZE) {
    for (let x = 0; x < width; x += TILE_SIZE) {
      tiles.push({
        x,
        y,
        width: Math.min(TILE_SIZE, width - x),
        height: Math.min(TILE_SIZE, height - y),
      });
    }
  }
  return tiles;
}

function fitWithin(width: number, height: number, maxEdge: number): Size {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Plan how to tile a source image of the given dimensions for a device profile
 * that allows at most `maxTiles` tiles per page.
 */
export function planTiles(srcWidth: number, srcHeight: number, maxTiles: number): TilePlan {
  // Small images pass through untouched.
  if (srcWidth <= TILE_SIZE && srcHeight <= TILE_SIZE) {
    return {
      scale: 1,
      scaledWidth: srcWidth,
      scaledHeight: srcHeight,
      grid: { rows: 1, cols: 1 },
      tiles: [{ x: 0, y: 0, width: srcWidth, height: srcHeight }],
      thumbnail: null,
    };
  }

  let scale = 1;
  let scaledWidth = srcWidth;
  let scaledHeight = srcHeight;
  let grid = computeGrid(scaledWidth, scaledHeight);

  if (grid.rows * grid.cols > maxTiles) {
    // Analytic starting point: tile count ≈ area / TILE². Then refine for ceil.
    scale = Math.min(1, Math.sqrt((maxTiles * TILE_SIZE * TILE_SIZE) / (srcWidth * srcHeight)));
    let guard = 0;
    do {
      scaledWidth = Math.max(1, Math.round(srcWidth * scale));
      scaledHeight = Math.max(1, Math.round(srcHeight * scale));
      grid = computeGrid(scaledWidth, scaledHeight);
      if (grid.rows * grid.cols <= maxTiles) break;
      scale *= 0.95;
      guard += 1;
    } while (guard < 200);
  }

  return {
    scale,
    scaledWidth,
    scaledHeight,
    grid,
    tiles: buildTiles(scaledWidth, scaledHeight),
    thumbnail: fitWithin(scaledWidth, scaledHeight, THUMBNAIL_MAX_EDGE),
  };
}

export interface PreprocessResult {
  tiles: ImageBitmap[];
  thumbnail: ImageBitmap | null;
  grid: { rows: number; cols: number };
  scale: number;
}

/** Apply a {@link TilePlan} to a source bitmap, producing tile + thumbnail bitmaps. */
export async function extractTiles(
  source: ImageBitmap,
  maxTiles: number,
): Promise<PreprocessResult> {
  const plan = planTiles(source.width, source.height, maxTiles);

  // Draw the (possibly downscaled) page once, then crop tiles from it.
  const page = new OffscreenCanvas(plan.scaledWidth, plan.scaledHeight);
  const pageCtx = page.getContext('2d');
  if (!pageCtx) throw new Error('OffscreenCanvas 2D context unavailable');
  pageCtx.drawImage(source, 0, 0, plan.scaledWidth, plan.scaledHeight);

  const tiles = await Promise.all(
    plan.tiles.map((tile) => createImageBitmap(page, tile.x, tile.y, tile.width, tile.height)),
  );

  let thumbnail: ImageBitmap | null = null;
  if (plan.thumbnail) {
    thumbnail = await createImageBitmap(page, {
      resizeWidth: plan.thumbnail.width,
      resizeHeight: plan.thumbnail.height,
      resizeQuality: 'high',
    });
  }

  return { tiles, thumbnail, grid: plan.grid, scale: plan.scale };
}
