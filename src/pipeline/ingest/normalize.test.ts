import { describe, expect, it } from 'vitest';
import { chwDims, pixelsToCHW } from './normalize.ts';

describe('pixelsToCHW', () => {
  it('lays out channels first (CHW) and normalizes with mean/std 0.5', () => {
    // 1×1 white pixel: (1 - 0.5) / 0.5 = 1 for every channel.
    const out = pixelsToCHW(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1);
    expect(Array.from(out)).toEqual([1, 1, 1]);
  });

  it('maps black to -1 under mean/std 0.5', () => {
    const out = pixelsToCHW(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1);
    expect(Array.from(out)).toEqual([-1, -1, -1]);
  });

  it('separates channels for a 2-pixel row', () => {
    // pixel0 red, pixel1 green
    const out = pixelsToCHW(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]), 2, 1);
    // R plane: [1, -1], G plane: [-1, 1], B plane: [-1, -1]
    expect(Array.from(out)).toEqual([1, -1, -1, 1, -1, -1]);
  });

  it('honors custom mean and std', () => {
    const out = pixelsToCHW(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1, {
      size: 1,
      mean: [0, 0, 0],
      std: [1, 1, 1],
    });
    expect(Array.from(out)).toEqual([1, 1, 1]);
  });

  it('produces [1,3,size,size] dims', () => {
    expect(chwDims(512)).toEqual([1, 3, 512, 512]);
  });
});
