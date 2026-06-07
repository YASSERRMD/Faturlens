import { describe, expect, it } from 'vitest';
import { classifyMemoryTier, detectMemory } from './memory.ts';

describe('classifyMemoryTier', () => {
  it('classifies below 8GB as low', () => {
    expect(classifyMemoryTier(4)).toBe('low');
    expect(classifyMemoryTier(7.9)).toBe('low');
  });

  it('classifies the 8GB boundary as standard', () => {
    expect(classifyMemoryTier(8)).toBe('standard');
  });

  it('classifies the 16GB boundary as standard', () => {
    expect(classifyMemoryTier(16)).toBe('standard');
  });

  it('classifies above 16GB as high', () => {
    expect(classifyMemoryTier(32)).toBe('high');
  });

  it('defaults to standard when memory is unknown', () => {
    expect(classifyMemoryTier(undefined)).toBe('standard');
  });
});

describe('detectMemory', () => {
  it('reads deviceMemory and classifies the tier', () => {
    const result = detectMemory({ deviceMemory: 4 }, {});
    expect(result.deviceMemoryGb).toBe(4);
    expect(result.tier).toBe('low');
  });

  it('omits deviceMemoryGb when navigator does not report it', () => {
    const result = detectMemory({}, {});
    expect(result.deviceMemoryGb).toBeUndefined();
    expect(result.tier).toBe('standard');
  });

  it('converts jsHeapSizeLimit from bytes to MB', () => {
    const result = detectMemory(
      { deviceMemory: 8 },
      { memory: { jsHeapSizeLimit: 2 * 1024 * 1024 * 1024 } },
    );
    expect(result.jsHeapLimitMb).toBe(2048);
  });

  it('omits jsHeapLimitMb when performance.memory is absent', () => {
    const result = detectMemory({ deviceMemory: 8 }, {});
    expect(result.jsHeapLimitMb).toBeUndefined();
  });
});
