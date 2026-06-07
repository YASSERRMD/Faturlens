import { describe, expect, it } from 'vitest';
import { computeGrid, planTiles, TILE_SIZE, THUMBNAIL_MAX_EDGE } from './preprocess.ts';

const tileCount = (w: number, h: number, max: number): number => {
  const p = planTiles(w, h, max);
  return p.grid.rows * p.grid.cols;
};

describe('computeGrid', () => {
  it('handles exact multiples', () => {
    expect(computeGrid(1024, 512)).toEqual({ cols: 2, rows: 1 });
  });
  it('rounds up off-by-one dimensions', () => {
    expect(computeGrid(1025, 512)).toEqual({ cols: 3, rows: 1 });
  });
});

describe('planTiles — pass-through (no upscaling)', () => {
  it('keeps a 512×512 image at scale 1 with one tile and no thumbnail', () => {
    const p = planTiles(512, 512, 6);
    expect(p.scale).toBe(1);
    expect(p.tiles).toHaveLength(1);
    expect(p.tiles[0]).toEqual({ x: 0, y: 0, width: 512, height: 512 });
    expect(p.thumbnail).toBeNull();
  });

  it('never upscales a tiny image', () => {
    const p = planTiles(100, 80, 6);
    expect(p.scale).toBe(1);
    expect(p.scaledWidth).toBe(100);
    expect(p.tiles).toHaveLength(1);
  });
});

describe('planTiles — grid geometry', () => {
  it('tiles an exact 1024×512 into two full tiles', () => {
    const p = planTiles(1024, 512, 6);
    expect(p.scale).toBe(1);
    expect(p.grid).toEqual({ cols: 2, rows: 1 });
    expect(p.tiles.map((t) => t.width)).toEqual([512, 512]);
  });

  it('produces a 1px remainder tile for 1025×512', () => {
    const p = planTiles(1025, 512, 6);
    expect(p.grid).toEqual({ cols: 3, rows: 1 });
    expect(p.tiles[2]?.width).toBe(1);
  });

  it('produces a 1px remainder tile for portrait 512×1025', () => {
    const p = planTiles(512, 1025, 6);
    expect(p.grid).toEqual({ cols: 1, rows: 3 });
    expect(p.tiles[2]?.height).toBe(1);
  });

  it('tiles a landscape receipt strip 1600×400 within budget', () => {
    const p = planTiles(1600, 400, 6);
    expect(p.scale).toBe(1);
    expect(p.grid).toEqual({ cols: 4, rows: 1 });
  });

  it('no tile exceeds 512px on either edge', () => {
    const p = planTiles(1600, 1100, 6);
    for (const tile of p.tiles) {
      expect(tile.width).toBeLessThanOrEqual(TILE_SIZE);
      expect(tile.height).toBeLessThanOrEqual(TILE_SIZE);
    }
  });

  it('tiles cover the full scaled width in the first row', () => {
    const p = planTiles(1300, 500, 6);
    const firstRow = p.tiles.filter((t) => t.y === 0);
    const covered = firstRow.reduce((sum, t) => sum + t.width, 0);
    expect(covered).toBe(p.scaledWidth);
  });
});

describe('planTiles — clamping to device budget', () => {
  it('downscales A4 portrait (1085×1536) to fit 6 tiles', () => {
    expect(tileCount(1085, 1536, 6)).toBeLessThanOrEqual(6);
    expect(planTiles(1085, 1536, 6).scale).toBeLessThan(1);
  });

  it('downscales a 2048×2048 page to fit 6 tiles', () => {
    expect(tileCount(2048, 2048, 6)).toBeLessThanOrEqual(6);
  });

  it('respects a low-tier budget of 4 tiles', () => {
    expect(tileCount(2048, 2048, 4)).toBeLessThanOrEqual(4);
    expect(tileCount(4096, 4096, 4)).toBeLessThanOrEqual(4);
    expect(planTiles(4096, 4096, 4).scale).toBeLessThan(1);
  });

  it('keeps a within-budget image at scale 1 even on low tier', () => {
    expect(planTiles(1024, 512, 4).scale).toBe(1);
  });
});

describe('planTiles — thumbnail', () => {
  it('caps the thumbnail longest edge at 512', () => {
    const p = planTiles(1600, 400, 6);
    expect(p.thumbnail).not.toBeNull();
    if (p.thumbnail) {
      expect(Math.max(p.thumbnail.width, p.thumbnail.height)).toBeLessThanOrEqual(
        THUMBNAIL_MAX_EDGE,
      );
    }
  });
});
