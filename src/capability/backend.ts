// Inference backend selection. Maps a DeviceProfile to the execution provider
// and ONNX dtype recipe that Transformers.js should use to load LFM2-VL, with a
// WebGPU → WASM fallback chain so the app adapts across machines:
//   - Mac / Windows with a (discrete or integrated) GPU → WebGPU, fp16 vision + q4 decoder
//   - No usable GPU → WASM (CPU), q4 everywhere
// Pure + unit-testable; no navigator access here.

import type { DeviceProfile } from './profile.ts';

export type TransformersDevice = 'webgpu' | 'wasm';
export type DtypeRecipe = Record<string, string> | string;

export interface BackendPlan {
  device: TransformersDevice;
  dtype: DtypeRecipe;
  /** Human-readable label for the UI / logs. */
  label: string;
}

export interface BackendSelection {
  primary: BackendPlan;
  /** Tried if the primary plan fails to load (null when there is nothing lower). */
  fallback: BackendPlan | null;
}

// Recommended WebGPU combo per the model card: fp16 vision encoder + q4 decoder.
const WEBGPU_DTYPE: DtypeRecipe = {
  embed_tokens: 'fp16',
  vision_encoder: 'fp16',
  decoder_model_merged: 'q4',
};

// CPU/WASM: fp16 is poorly supported on WASM, so quantize everything.
const WASM_DTYPE: DtypeRecipe = 'q4';

const WEBGPU_PLAN: BackendPlan = {
  device: 'webgpu',
  dtype: WEBGPU_DTYPE,
  label: 'WebGPU · fp16 vision + q4 decoder',
};

const WASM_PLAN: BackendPlan = {
  device: 'wasm',
  dtype: WASM_DTYPE,
  label: 'WASM (CPU) · q4',
};

/** Choose the inference backend (and a fallback) for the given device profile. */
export function selectBackend(profile: DeviceProfile): BackendSelection {
  if (profile.executionProvider === 'webgpu') {
    // Try WebGPU first; if device creation fails at load time, fall back to WASM.
    return { primary: WEBGPU_PLAN, fallback: WASM_PLAN };
  }
  return { primary: WASM_PLAN, fallback: null };
}
