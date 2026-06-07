import { describe, expect, it } from 'vitest';
import { detectWebGpu, type NavigatorGpuLike } from './webgpu.ts';

describe('detectWebGpu', () => {
  it('reports unavailable when navigator.gpu is missing', async () => {
    const result = await detectWebGpu({});
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toMatch(/navigator\.gpu/);
  });

  it('reports unavailable when requestAdapter rejects', async () => {
    const nav: NavigatorGpuLike = {
      gpu: {
        requestAdapter: () => Promise.reject(new Error('GPU process crashed')),
      },
    };
    const result = await detectWebGpu(nav);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toMatch(/GPU process crashed/);
  });

  it('reports unavailable when requestAdapter resolves null', async () => {
    const nav: NavigatorGpuLike = {
      gpu: { requestAdapter: () => Promise.resolve(null) },
    };
    const result = await detectWebGpu(nav);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toMatch(/no webgpu adapter/i);
  });

  it('reads limits and info from a discrete adapter', async () => {
    const nav: NavigatorGpuLike = {
      gpu: {
        requestAdapter: () =>
          Promise.resolve({
            limits: { maxBufferSize: 2147483648, maxStorageBufferBindingSize: 1073741824 },
            info: { vendor: 'nvidia', architecture: 'ada', device: 'RTX 4090' },
            isFallbackAdapter: false,
          }),
      },
    };
    const result = await detectWebGpu(nav);
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.limits.maxBufferSize).toBe(2147483648);
      expect(result.info.vendor).toBe('nvidia');
      expect(result.isFallbackAdapter).toBe(false);
    }
  });

  it('flags a fallback (software) adapter', async () => {
    const nav: NavigatorGpuLike = {
      gpu: {
        requestAdapter: () => Promise.resolve({ limits: {}, info: {}, isFallbackAdapter: true }),
      },
    };
    const result = await detectWebGpu(nav);
    expect(result.available).toBe(true);
    if (result.available) expect(result.isFallbackAdapter).toBe(true);
  });

  it('falls back to requestAdapterInfo when info property is absent', async () => {
    const nav: NavigatorGpuLike = {
      gpu: {
        requestAdapter: () =>
          Promise.resolve({
            limits: {},
            requestAdapterInfo: () => Promise.resolve({ vendor: 'intel', device: 'Iris Xe' }),
          }),
      },
    };
    const result = await detectWebGpu(nav);
    expect(result.available).toBe(true);
    if (result.available) expect(result.info.device).toBe('Iris Xe');
  });

  it('tolerates an adapter with no limits object', async () => {
    const nav: NavigatorGpuLike = {
      gpu: { requestAdapter: () => Promise.resolve({}) },
    };
    const result = await detectWebGpu(nav);
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.limits).toEqual({});
      expect(result.isFallbackAdapter).toBe(false);
    }
  });
});
