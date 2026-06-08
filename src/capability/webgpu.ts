// WebGPU adapter detection. Pure detection — never throws, always returns a
// typed result. Structural interfaces are used instead of @webgpu/types so the
// module stays dependency-free and trivially mockable in unit tests.

export interface WebGpuLimits {
  maxBufferSize?: number;
  maxStorageBufferBindingSize?: number;
}

export interface WebGpuAdapterInfo {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}

export type WebGpuDetection =
  | {
      available: true;
      limits: WebGpuLimits;
      info: WebGpuAdapterInfo;
      isFallbackAdapter: boolean;
    }
  | { available: false; reason: string };

interface GpuAdapterLike {
  readonly limits?: Record<string, number> | undefined;
  readonly info?: WebGpuAdapterInfo | undefined;
  readonly isFallbackAdapter?: boolean | undefined;
  requestAdapterInfo?: () => Promise<WebGpuAdapterInfo>;
}

interface GpuLike {
  requestAdapter: (options?: unknown) => Promise<GpuAdapterLike | null>;
}

export interface NavigatorGpuLike {
  gpu?: GpuLike | undefined;
}

function readLimits(adapter: GpuAdapterLike): WebGpuLimits {
  const limits = adapter.limits;
  if (!limits) return {};
  const result: WebGpuLimits = {};
  const maxBufferSize = limits.maxBufferSize;
  const maxStorageBufferBindingSize = limits.maxStorageBufferBindingSize;
  if (typeof maxBufferSize === 'number') result.maxBufferSize = maxBufferSize;
  if (typeof maxStorageBufferBindingSize === 'number') {
    result.maxStorageBufferBindingSize = maxStorageBufferBindingSize;
  }
  return result;
}

// Copy the fields into a plain object. The live GPUAdapterInfo is a host object
// that cannot be structured-cloned (e.g. postMessage'd to the worker).
function plainInfo(info: WebGpuAdapterInfo | undefined): WebGpuAdapterInfo {
  if (!info) return {};
  const result: WebGpuAdapterInfo = {};
  if (typeof info.vendor === 'string') result.vendor = info.vendor;
  if (typeof info.architecture === 'string') result.architecture = info.architecture;
  if (typeof info.device === 'string') result.device = info.device;
  if (typeof info.description === 'string') result.description = info.description;
  return result;
}

async function readInfo(adapter: GpuAdapterLike): Promise<WebGpuAdapterInfo> {
  if (adapter.info) return plainInfo(adapter.info);
  if (adapter.requestAdapterInfo) {
    try {
      return plainInfo(await adapter.requestAdapterInfo());
    } catch {
      return {};
    }
  }
  return {};
}

function resolveNavigator(nav?: NavigatorGpuLike): NavigatorGpuLike | undefined {
  if (nav) return nav;
  if (typeof navigator === 'undefined') return undefined;
  return navigator as unknown as NavigatorGpuLike;
}

/**
 * Probe for a usable WebGPU adapter. Returns a typed result describing the
 * adapter's limits and info, or the reason no adapter is available.
 */
export async function detectWebGpu(nav?: NavigatorGpuLike): Promise<WebGpuDetection> {
  const resolved = resolveNavigator(nav);
  if (!resolved?.gpu) {
    return { available: false, reason: 'navigator.gpu is not available in this browser' };
  }

  let adapter: GpuAdapterLike | null;
  try {
    adapter = await resolved.gpu.requestAdapter({ powerPreference: 'high-performance' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { available: false, reason: `requestAdapter threw: ${message}` };
  }

  if (!adapter) {
    return { available: false, reason: 'No WebGPU adapter was returned by the browser' };
  }

  return {
    available: true,
    limits: readLimits(adapter),
    info: await readInfo(adapter),
    isFallbackAdapter: adapter.isFallbackAdapter === true,
  };
}
