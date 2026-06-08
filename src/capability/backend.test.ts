import { describe, expect, it } from 'vitest';
import { selectBackend } from './backend.ts';
import type { DeviceProfile } from './profile.ts';

const profile = (executionProvider: 'webgpu' | 'wasm'): DeviceProfile => ({
  executionProvider,
  imageTokenBudget: 256,
  maxTilesPerPage: 6,
  concurrency: 1,
  memoryTier: 'standard',
  warnings: [],
  webgpu: { available: false, reason: 'test' },
  memory: { tier: 'standard' },
});

describe('selectBackend', () => {
  it('uses WebGPU (fp16 vision + q4 decoder) with a WASM fallback when a GPU is present', () => {
    const sel = selectBackend(profile('webgpu'));
    expect(sel.primary.device).toBe('webgpu');
    expect(sel.primary.dtype).toMatchObject({ vision_encoder: 'fp16', decoder_model_merged: 'q4' });
    expect(sel.fallback?.device).toBe('wasm');
  });

  it('uses WASM with no fallback when there is no GPU', () => {
    const sel = selectBackend(profile('wasm'));
    expect(sel.primary.device).toBe('wasm');
    expect(sel.primary.dtype).toBe('q4');
    expect(sel.fallback).toBeNull();
  });
});
