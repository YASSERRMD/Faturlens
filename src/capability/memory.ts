// System memory classification. Reads navigator.deviceMemory (Chrome) and
// performance.memory where present. Pure detection, never throws.

export type MemoryTier = 'low' | 'standard' | 'high';

export interface MemoryDetection {
  /** navigator.deviceMemory in GB, if the browser reports it. */
  deviceMemoryGb?: number;
  /** performance.memory.jsHeapSizeLimit in MB, if present. */
  jsHeapLimitMb?: number;
  tier: MemoryTier;
}

interface NavigatorMemoryLike {
  deviceMemory?: number | undefined;
}

interface PerformanceMemoryLike {
  memory?:
    | {
        jsHeapSizeLimit?: number | undefined;
      }
    | undefined;
}

/**
 * Classify the machine's memory tier.
 *
 * - `low`: < 8 GB
 * - `standard`: 8–16 GB (Chrome caps `deviceMemory` at 8, so most machines land here)
 * - `high`: > 16 GB (reported by non-Chrome browsers)
 *
 * When `deviceMemory` is unavailable we conservatively assume `standard`.
 */
export function classifyMemoryTier(deviceMemoryGb: number | undefined): MemoryTier {
  if (deviceMemoryGb === undefined) return 'standard';
  if (deviceMemoryGb < 8) return 'low';
  if (deviceMemoryGb > 16) return 'high';
  return 'standard';
}

function resolveNavigator(nav?: NavigatorMemoryLike): NavigatorMemoryLike | undefined {
  if (nav) return nav;
  if (typeof navigator === 'undefined') return undefined;
  return navigator as unknown as NavigatorMemoryLike;
}

function resolvePerformance(perf?: PerformanceMemoryLike): PerformanceMemoryLike | undefined {
  if (perf) return perf;
  if (typeof performance === 'undefined') return undefined;
  return performance as unknown as PerformanceMemoryLike;
}

export function detectMemory(
  nav?: NavigatorMemoryLike,
  perf?: PerformanceMemoryLike,
): MemoryDetection {
  const resolvedNav = resolveNavigator(nav);
  const resolvedPerf = resolvePerformance(perf);

  const deviceMemoryGb =
    typeof resolvedNav?.deviceMemory === 'number' ? resolvedNav.deviceMemory : undefined;

  const heapLimitBytes = resolvedPerf?.memory?.jsHeapSizeLimit;
  const jsHeapLimitMb =
    typeof heapLimitBytes === 'number' ? Math.round(heapLimitBytes / (1024 * 1024)) : undefined;

  const detection: MemoryDetection = { tier: classifyMemoryTier(deviceMemoryGb) };
  if (deviceMemoryGb !== undefined) detection.deviceMemoryGb = deviceMemoryGb;
  if (jsHeapLimitMb !== undefined) detection.jsHeapLimitMb = jsHeapLimitMb;
  return detection;
}
