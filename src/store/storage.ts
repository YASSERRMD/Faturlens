// Storage budget estimation via navigator.storage.estimate().

export interface StorageEstimateResult {
  usage: number;
  quota: number;
  fraction: number;
  /** True at or above the 80% warning threshold. */
  warn: boolean;
}

export const STORAGE_WARN_FRACTION = 0.8;

export function classifyEstimate(usage: number, quota: number): StorageEstimateResult {
  const fraction = quota > 0 ? usage / quota : 0;
  return { usage, quota, fraction, warn: fraction >= STORAGE_WARN_FRACTION };
}

export async function estimateStorage(): Promise<StorageEstimateResult | null> {
  const storage = (globalThis.navigator as Navigator | undefined)?.storage;
  if (!storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await storage.estimate();
  return classifyEstimate(usage, quota);
}
