// Device profile composition. Combines WebGPU and memory detection into the
// single decision object that drives how Faturlens runs on this machine.

import { detectMemory, type MemoryDetection, type MemoryTier } from './memory.ts';
import { detectWebGpu, type WebGpuDetection } from './webgpu.ts';

export type ExecutionProvider = 'webgpu' | 'wasm';

export interface DeviceProfile {
  executionProvider: ExecutionProvider;
  /** Image tokens budgeted per tile. */
  imageTokenBudget: number;
  maxTilesPerPage: number;
  /** Always 1 — a single inference at a time is a hard architectural rule. */
  concurrency: 1;
  memoryTier: MemoryTier;
  warnings: string[];
  webgpu: WebGpuDetection;
  memory: MemoryDetection;
}

// Budget constants, kept in one place so the report and tests reference them.
export const TOKEN_BUDGET_FULL = 256;
export const TOKEN_BUDGET_REDUCED = 128;
export const MAX_TILES_WEBGPU = 6;
export const MAX_TILES_WASM = 4;

/**
 * Pure composition of detection results into a {@link DeviceProfile}. Separated
 * from the async detection so it can be unit-tested without any navigator.
 */
export function composeProfile(webgpu: WebGpuDetection, memory: MemoryDetection): DeviceProfile {
  const warnings: string[] = [];
  const executionProvider: ExecutionProvider = webgpu.available ? 'webgpu' : 'wasm';

  if (!webgpu.available) {
    warnings.push(`No WebGPU adapter found, CPU mode will be slow (${webgpu.reason})`);
  } else if (webgpu.isFallbackAdapter) {
    warnings.push('WebGPU is using a fallback (software) adapter; performance will be poor');
  }

  if (memory.deviceMemoryGb === undefined) {
    warnings.push('Device memory could not be detected; assuming standard tier');
  }
  if (memory.tier === 'low') {
    warnings.push('Low system memory detected; image token budget reduced');
  }

  const reducedBudget = executionProvider === 'wasm' || memory.tier === 'low';
  const imageTokenBudget = reducedBudget ? TOKEN_BUDGET_REDUCED : TOKEN_BUDGET_FULL;
  const maxTilesPerPage = executionProvider === 'webgpu' ? MAX_TILES_WEBGPU : MAX_TILES_WASM;

  return {
    executionProvider,
    imageTokenBudget,
    maxTilesPerPage,
    concurrency: 1,
    memoryTier: memory.tier,
    warnings,
    webgpu,
    memory,
  };
}

interface ResolveOptions {
  navigator?: Parameters<typeof detectWebGpu>[0] & Parameters<typeof detectMemory>[0];
  performance?: Parameters<typeof detectMemory>[1];
}

/**
 * Run full device detection and compose the profile. Detection is best-effort
 * and never throws; failures are surfaced as warnings on the returned profile.
 */
export async function resolveDeviceProfile(options: ResolveOptions = {}): Promise<DeviceProfile> {
  const webgpu = await detectWebGpu(options.navigator);
  const memory = detectMemory(options.navigator, options.performance);
  return composeProfile(webgpu, memory);
}
