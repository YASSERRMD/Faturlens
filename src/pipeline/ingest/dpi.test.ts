import { describe, expect, it } from 'vitest';
import { MAX_LONG_EDGE_PX, sizingForPage, TARGET_LONG_EDGE_PX } from './dpi.ts';

describe('sizingForPage', () => {
  it('targets ~1536px on the long edge for A4 portrait (595×842pt)', () => {
    const s = sizingForPage(595, 842);
    expect(Math.max(s.width, s.height)).toBe(TARGET_LONG_EDGE_PX);
    expect(s.height).toBe(TARGET_LONG_EDGE_PX);
  });

  it('targets ~1536px for US Letter (612×792pt)', () => {
    const s = sizingForPage(612, 792);
    expect(s.height).toBe(TARGET_LONG_EDGE_PX);
  });

  it('handles a tall receipt (288×720pt)', () => {
    const s = sizingForPage(288, 720);
    expect(s.height).toBe(TARGET_LONG_EDGE_PX);
    expect(s.width).toBeLessThan(s.height);
  });

  it('never exceeds the 2048px cap', () => {
    const s = sizingForPage(2000, 4000);
    expect(Math.max(s.width, s.height)).toBeLessThanOrEqual(MAX_LONG_EDGE_PX);
  });

  it('derives dpi from the scale', () => {
    const s = sizingForPage(595, 842);
    expect(s.dpi).toBeCloseTo(s.scale * 72, 5);
  });
});
