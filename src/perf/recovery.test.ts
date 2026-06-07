import { describe, expect, it } from 'vitest';
import { initialRecoveryState, onDeviceLost } from './recovery.ts';

describe('onDeviceLost', () => {
  it('recreates WebGPU on the first loss', () => {
    const { state, decision } = onDeviceLost(initialRecoveryState('webgpu'), 1000);
    expect(decision).toBe('recreate-webgpu');
    expect(state.provider).toBe('webgpu');
  });

  it('demotes to WASM on a second loss within the window', () => {
    let state = initialRecoveryState('webgpu');
    ({ state } = onDeviceLost(state, 1000));
    const second = onDeviceLost(state, 1000 + 60_000); // 1 min later
    expect(second.decision).toBe('demote-to-wasm');
    expect(second.state.provider).toBe('wasm');
  });

  it('recreates WebGPU when the second loss is outside the window', () => {
    let state = initialRecoveryState('webgpu');
    ({ state } = onDeviceLost(state, 1000));
    const later = onDeviceLost(state, 1000 + 11 * 60_000); // 11 min later
    expect(later.decision).toBe('recreate-webgpu');
    expect(later.state.provider).toBe('webgpu');
  });

  it('just recreates WASM sessions when already on WASM', () => {
    const { decision } = onDeviceLost(initialRecoveryState('wasm'), 1000);
    expect(decision).toBe('recreate-wasm');
  });
});
