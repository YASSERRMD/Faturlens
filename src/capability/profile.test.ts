import { describe, expect, it } from 'vitest';
import type { MemoryDetection } from './memory.ts';
import {
  composeProfile,
  MAX_TILES_WASM,
  MAX_TILES_WEBGPU,
  resolveDeviceProfile,
  TOKEN_BUDGET_FULL,
  TOKEN_BUDGET_REDUCED,
} from './profile.ts';
import type { WebGpuDetection } from './webgpu.ts';

const webgpuOk: WebGpuDetection = {
  available: true,
  limits: { maxBufferSize: 2147483648 },
  info: { vendor: 'intel', device: 'Iris Xe' },
  isFallbackAdapter: false,
};
const webgpuFallback: WebGpuDetection = { ...webgpuOk, isFallbackAdapter: true };
const webgpuNone: WebGpuDetection = { available: false, reason: 'navigator.gpu missing' };

const mem = (tier: MemoryDetection['tier'], deviceMemoryGb?: number): MemoryDetection =>
  deviceMemoryGb === undefined ? { tier } : { tier, deviceMemoryGb };

describe('composeProfile', () => {
  it('webgpu + standard memory → full budget, 6 tiles', () => {
    const p = composeProfile(webgpuOk, mem('standard', 8));
    expect(p.executionProvider).toBe('webgpu');
    expect(p.imageTokenBudget).toBe(TOKEN_BUDGET_FULL);
    expect(p.maxTilesPerPage).toBe(MAX_TILES_WEBGPU);
    expect(p.concurrency).toBe(1);
    expect(p.warnings).toHaveLength(0);
  });

  it('high-end discrete GPU → webgpu, full budget', () => {
    const p = composeProfile(webgpuOk, mem('high', 32));
    expect(p.executionProvider).toBe('webgpu');
    expect(p.imageTokenBudget).toBe(TOKEN_BUDGET_FULL);
    expect(p.maxTilesPerPage).toBe(MAX_TILES_WEBGPU);
  });

  it('no webgpu → wasm, reduced budget, 4 tiles, warning', () => {
    const p = composeProfile(webgpuNone, mem('standard', 8));
    expect(p.executionProvider).toBe('wasm');
    expect(p.imageTokenBudget).toBe(TOKEN_BUDGET_REDUCED);
    expect(p.maxTilesPerPage).toBe(MAX_TILES_WASM);
    expect(p.warnings.some((w) => w.includes('CPU mode will be slow'))).toBe(true);
  });

  it('webgpu + low memory → reduced budget but still 6 tiles', () => {
    const p = composeProfile(webgpuOk, mem('low', 4));
    expect(p.executionProvider).toBe('webgpu');
    expect(p.imageTokenBudget).toBe(TOKEN_BUDGET_REDUCED);
    expect(p.maxTilesPerPage).toBe(MAX_TILES_WEBGPU);
    expect(p.warnings.some((w) => w.includes('Low system memory'))).toBe(true);
  });

  it('fallback adapter raises a performance warning', () => {
    const p = composeProfile(webgpuFallback, mem('standard', 8));
    expect(p.warnings.some((w) => w.includes('fallback'))).toBe(true);
  });

  it('unknown device memory raises a warning and assumes standard', () => {
    const p = composeProfile(webgpuOk, mem('standard'));
    expect(p.memoryTier).toBe('standard');
    expect(p.warnings.some((w) => w.includes('could not be detected'))).toBe(true);
  });

  it('wasm + low memory keeps the reduced budget (no double-penalty)', () => {
    const p = composeProfile(webgpuNone, mem('low', 4));
    expect(p.imageTokenBudget).toBe(TOKEN_BUDGET_REDUCED);
    expect(p.maxTilesPerPage).toBe(MAX_TILES_WASM);
  });
});

describe('resolveDeviceProfile', () => {
  it('runs detection end-to-end with injected fakes', async () => {
    const p = await resolveDeviceProfile({
      navigator: {
        gpu: {
          requestAdapter: () =>
            Promise.resolve({ limits: {}, info: { vendor: 'amd' }, isFallbackAdapter: false }),
        },
        deviceMemory: 8,
      },
      performance: {},
    });
    expect(p.executionProvider).toBe('webgpu');
    expect(p.memoryTier).toBe('standard');
  });

  it('produces a wasm profile when no gpu and no deviceMemory are present', async () => {
    const p = await resolveDeviceProfile({ navigator: {}, performance: {} });
    expect(p.executionProvider).toBe('wasm');
    expect(p.warnings.length).toBeGreaterThanOrEqual(2);
  });
});
