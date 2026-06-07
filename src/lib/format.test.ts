import { describe, expect, it } from 'vitest';
import { formatBytes, formatPercent } from './format.ts';

describe('formatBytes', () => {
  it('formats bytes under 1KB verbatim', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(2_130_132_992)).toBe('2.0 GB');
  });
});

describe('formatPercent', () => {
  it('rounds to whole percent', () => {
    expect(formatPercent(0.337)).toBe('34%');
  });

  it('clamps out-of-range fractions', () => {
    expect(formatPercent(1.4)).toBe('100%');
    expect(formatPercent(-0.2)).toBe('0%');
  });
});
