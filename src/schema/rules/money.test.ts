import { describe, expect, it } from 'vitest';
import { approxEqualMinor, sumMinor, toMinor } from './money.ts';

describe('toMinor', () => {
  it('converts to integer minor units, rounding to nearest', () => {
    expect(toMinor(1.5)).toBe(150);
    expect(toMinor(100)).toBe(10000);
    expect(toMinor(0.014)).toBe(1); // 1.4 minor units → 1
  });
});

describe('approxEqualMinor', () => {
  it('treats values within tolerance as equal', () => {
    expect(approxEqualMinor(100.0, 100.01, 1)).toBe(true);
    expect(approxEqualMinor(100.0, 100.02, 1)).toBe(false);
  });
  it('uses a default tolerance of one minor unit', () => {
    expect(approxEqualMinor(50.0, 50.01)).toBe(true);
  });
});

describe('sumMinor', () => {
  it('sums without floating-point drift', () => {
    expect(sumMinor([0.1, 0.2])).toBe(0.3);
    expect(sumMinor([10.5, 20.25, 5.25])).toBe(36);
  });
});
