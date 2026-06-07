// ORT InferenceSession creation from cached model bytes. WebGPU EP when the
// profile allows, WASM otherwise. Per the official LFM2.5-VL recipe, WASM
// threading is pinned to 1 on the WebGPU path.

import * as ort from 'onnxruntime-web';
import type { DeviceProfile } from '../capability/profile.ts';
import { getFile, openModelCache, type CacheLike } from './loader/cache.ts';
import type { LoadStage } from './protocol.ts';

export interface ModelSessions {
  visionEncoder: ort.InferenceSession;
  decoder: ort.InferenceSession;
  embedTokens: ort.InferenceSession;
  dispose: () => Promise<void>;
}

interface SessionSpec {
  graph: string;
  data: string;
}

const ENCODER: SessionSpec = {
  graph: 'onnx/embed_images_fp16.onnx',
  data: 'onnx/embed_images_fp16.onnx_data',
};
const DECODER: SessionSpec = {
  graph: 'onnx/decoder_q4.onnx',
  data: 'onnx/decoder_q4.onnx_data',
};
const EMBED_TOKENS: SessionSpec = {
  graph: 'onnx/embed_tokens_fp16.onnx',
  data: 'onnx/embed_tokens_fp16.onnx_data',
};

/** Basename used by the .onnx graph to reference its external weights. */
function externalDataName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

function configureRuntime(profile: DeviceProfile): void {
  if (profile.executionProvider === 'webgpu') {
    // The WebGPU recipe requires single-threaded WASM for the fallback ops.
    ort.env.wasm.numThreads = 1;
  }
  ort.env.wasm.simd = true;
}

async function readSpec(
  spec: SessionSpec,
  cache: CacheLike,
): Promise<{
  graph: Uint8Array;
  data: Uint8Array;
}> {
  const graph = await getFile(spec.graph, cache);
  const data = await getFile(spec.data, cache);
  if (!graph || !data) {
    throw new Error(`Model artifact missing from cache: ${spec.graph}`);
  }
  return { graph, data };
}

async function createSession(
  spec: SessionSpec,
  cache: CacheLike,
  provider: 'webgpu' | 'wasm',
): Promise<ort.InferenceSession> {
  const { graph, data } = await readSpec(spec, cache);
  return ort.InferenceSession.create(graph, {
    executionProviders: [provider],
    externalData: [{ path: externalDataName(spec.data), data }],
    graphOptimizationLevel: 'all',
  });
}

export interface CreateSessionsOptions {
  cache?: CacheLike;
  onProgress?: (stage: LoadStage, fraction: number) => void;
}

/** Create all three model sessions from the cached, verified bytes. */
export async function createSessions(
  profile: DeviceProfile,
  options: CreateSessionsOptions = {},
): Promise<ModelSessions> {
  const cache = options.cache ?? (await openModelCache());
  const provider = profile.executionProvider;
  configureRuntime(profile);

  options.onProgress?.('creating-sessions', 0);
  const embedTokens = await createSession(EMBED_TOKENS, cache, provider);
  options.onProgress?.('creating-sessions', 1 / 3);
  const visionEncoder = await createSession(ENCODER, cache, provider);
  options.onProgress?.('creating-sessions', 2 / 3);
  const decoder = await createSession(DECODER, cache, provider);
  options.onProgress?.('creating-sessions', 1);

  return {
    visionEncoder,
    decoder,
    embedTokens,
    dispose: async () => {
      await Promise.all([embedTokens.release(), visionEncoder.release(), decoder.release()]);
    },
  };
}
