/// <reference lib="webworker" />
// Inference worker entry point. Wires the message protocol to ORT sessions and
// the generation loop. Enforces a single in-flight inference; concurrent infer
// messages are rejected with a typed error (queueing is the client's job).

import { AutoTokenizer } from '@huggingface/transformers';
import * as ort from 'onnxruntime-web';
import type { DeviceProfile } from '../capability/profile.ts';
import { runGeneration, type DecoderConfig, type TokenizerLike } from './generate.ts';
import { getFile, openModelCache, type CacheLike } from './loader/cache.ts';
import { MODEL_REPO } from './loader/manifest.ts';
import { isMainToWorker, type MainToWorker, type WorkerToMain } from './protocol.ts';
import { createSessions, type ModelSessions } from './sessions.ts';

declare const self: DedicatedWorkerGlobalScope;

interface RawConfig {
  num_hidden_layers?: number;
  num_key_value_heads?: number;
  num_attention_heads?: number;
  head_dim?: number;
  hidden_size?: number;
  eos_token_id?: number | number[];
  image_token_id?: number;
  image_token_index?: number;
  text_config?: RawConfig;
}

let sessions: ModelSessions | null = null;
let tokenizer: TokenizerLike | null = null;
let decoderConfig: DecoderConfig | null = null;
let activeId: string | null = null;
let abortRequested = false;

function post(message: WorkerToMain): void {
  self.postMessage(message);
}

function asDecoderConfig(raw: RawConfig): DecoderConfig {
  const text = raw.text_config ?? raw;
  const numLayers = text.num_hidden_layers ?? 24;
  const numAttnHeads = text.num_attention_heads ?? 16;
  const numKeyValueHeads = text.num_key_value_heads ?? numAttnHeads;
  const hiddenSize = text.hidden_size ?? 2048;
  const headDim = text.head_dim ?? Math.floor(hiddenSize / numAttnHeads);
  const eos = Array.isArray(text.eos_token_id)
    ? (text.eos_token_id[0] ?? 0)
    : (text.eos_token_id ?? 0);
  const imageToken = raw.image_token_id ?? raw.image_token_index ?? 0;
  return {
    numLayers,
    numKeyValueHeads,
    headDim,
    eosTokenId: eos,
    imageTokenId: imageToken,
  };
}

async function loadConfig(cache: CacheLike): Promise<DecoderConfig> {
  const bytes = await getFile('config.json', cache);
  if (!bytes) throw new Error('config.json missing from cache');
  const raw = JSON.parse(new TextDecoder().decode(bytes)) as RawConfig;
  return asDecoderConfig(raw);
}

function adaptTokenizer(instance: {
  encode: (text: string) => number[];
  decode: (ids: number[], options?: { skip_special_tokens?: boolean }) => string;
}): TokenizerLike {
  return {
    encode: (text) => instance.encode(text),
    decode: (ids) => instance.decode(ids, { skip_special_tokens: true }),
  };
}

async function handleLoad(profile: DeviceProfile): Promise<void> {
  const cache = await openModelCache();
  post({ type: 'load-progress', stage: 'reading-cache', fraction: 0 });

  decoderConfig = await loadConfig(cache);
  const loaded = await AutoTokenizer.from_pretrained(MODEL_REPO);
  tokenizer = adaptTokenizer(loaded);

  sessions = await createSessions(profile, {
    cache,
    onProgress: (stage, fraction) => {
      post({ type: 'load-progress', stage, fraction });
    },
  });

  post({ type: 'load-progress', stage: 'warming-up', fraction: 1 });
  post({ type: 'ready' });
}

async function encodeTiles(images: ImageBitmap[]): Promise<ort.Tensor[]> {
  if (!sessions || images.length === 0) return [];
  const embeds: ort.Tensor[] = [];
  for (const image of images) {
    const pixels = imageToPixelTensor(image);
    const out = await sessions.visionEncoder.run({ pixel_values: pixels });
    pixels.dispose();
    const features = out.image_features ?? Object.values(out)[0];
    if (features instanceof ort.Tensor) embeds.push(features);
  }
  return embeds;
}

const PIXEL_SIZE = 512;
const PIXEL_MEAN = 0.5;
const PIXEL_STD = 0.5;

function imageToPixelTensor(image: ImageBitmap): ort.Tensor {
  const canvas = new OffscreenCanvas(PIXEL_SIZE, PIXEL_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
  ctx.drawImage(image, 0, 0, PIXEL_SIZE, PIXEL_SIZE);
  const { data } = ctx.getImageData(0, 0, PIXEL_SIZE, PIXEL_SIZE);

  const plane = PIXEL_SIZE * PIXEL_SIZE;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i += 1) {
    const r = (data[i * 4] ?? 0) / 255;
    const g = (data[i * 4 + 1] ?? 0) / 255;
    const b = (data[i * 4 + 2] ?? 0) / 255;
    out[i] = (r - PIXEL_MEAN) / PIXEL_STD;
    out[plane + i] = (g - PIXEL_MEAN) / PIXEL_STD;
    out[2 * plane + i] = (b - PIXEL_MEAN) / PIXEL_STD;
  }
  return new ort.Tensor('float32', out, [1, 3, PIXEL_SIZE, PIXEL_SIZE]);
}

async function handleInfer(message: Extract<MainToWorker, { type: 'infer' }>): Promise<void> {
  if (activeId !== null) {
    post({
      type: 'error',
      id: message.id,
      message: 'An inference is already in progress',
      recoverable: true,
    });
    return;
  }
  if (!sessions || !tokenizer || !decoderConfig) {
    post({ type: 'error', id: message.id, message: 'Model is not loaded', recoverable: false });
    return;
  }

  activeId = message.id;
  abortRequested = false;
  const imageEmbeds = await encodeTiles(message.images);

  try {
    const { fullText, stats } = await runGeneration({
      sessions,
      tokenizer,
      config: decoderConfig,
      prompt: message.prompt,
      imageEmbeds,
      maxNewTokens: message.maxNewTokens,
      shouldAbort: () => abortRequested,
      onToken: (text) => {
        post({ type: 'token', id: message.id, text });
      },
      now: () => performance.now(),
    });
    post({ type: 'done', id: message.id, fullText, stats });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    post({ type: 'error', id: message.id, message: msg, recoverable: true });
  } finally {
    for (const embed of imageEmbeds) {
      try {
        embed.dispose();
      } catch {
        // already released
      }
    }
    activeId = null;
  }
}

async function handleMessage(message: MainToWorker): Promise<void> {
  switch (message.type) {
    case 'load':
      await handleLoad(message.profile);
      return;
    case 'infer':
      await handleInfer(message);
      return;
    case 'abort':
      if (activeId === message.id) abortRequested = true;
      return;
    case 'dispose':
      await sessions?.dispose();
      sessions = null;
      tokenizer = null;
      decoderConfig = null;
      return;
    default:
      return;
  }
}

self.addEventListener('message', (event: MessageEvent) => {
  if (!isMainToWorker(event.data)) return;
  void handleMessage(event.data).catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    post({ type: 'error', message: msg, recoverable: false });
  });
});
