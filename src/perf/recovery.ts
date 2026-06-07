// WebGPU device-lost recovery ladder. Pure state machine: the first loss
// recreates sessions; a second loss within the window demotes to WASM.

import type { ExecutionProvider } from '../capability/profile.ts';

export const REPEATED_LOSS_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export interface RecoveryState {
  provider: ExecutionProvider;
  /** Timestamps of recent device-loss events. */
  lossTimestamps: number[];
}

export type RecoveryDecision = 'recreate-webgpu' | 'demote-to-wasm' | 'recreate-wasm';

export interface RecoveryOutcome {
  state: RecoveryState;
  decision: RecoveryDecision;
}

export function initialRecoveryState(provider: ExecutionProvider): RecoveryState {
  return { provider, lossTimestamps: [] };
}

/**
 * Decide how to recover from a device-lost event at time `now`.
 * - Already on WASM → just recreate WASM sessions.
 * - First WebGPU loss (in window) → recreate WebGPU.
 * - Second WebGPU loss within the window → demote to WASM.
 */
export function onDeviceLost(
  state: RecoveryState,
  now: number,
  windowMs = REPEATED_LOSS_WINDOW_MS,
): RecoveryOutcome {
  if (state.provider === 'wasm') {
    return { state, decision: 'recreate-wasm' };
  }

  const recent = state.lossTimestamps.filter((t) => now - t <= windowMs);
  recent.push(now);

  if (recent.length >= 2) {
    return {
      state: { provider: 'wasm', lossTimestamps: recent },
      decision: 'demote-to-wasm',
    };
  }
  return {
    state: { provider: 'webgpu', lossTimestamps: recent },
    decision: 'recreate-webgpu',
  };
}
