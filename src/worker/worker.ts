/// <reference lib="webworker" />
// Inference worker. Generation is driven by Transformers.js 4.x, which ships the
// real LFM2-VL implementation (Lfm2VlProcessor + Lfm2VlForConditionalGeneration)
// — correct image preprocessing (tiling/patches/spatial_shapes), chat template,
// image-token merge, and the hybrid conv+attention KV cache. Single in-flight;
// concurrent infer messages are rejected with a typed error.

import {
  AutoModelForImageTextToText,
  AutoTokenizer,
  env,
  Lfm2VlImageProcessor,
  Lfm2VlProcessor,
  RawImage,
  TextStreamer,
} from '@huggingface/transformers';
import { selectBackend, type BackendPlan } from '../capability/backend.ts';
import type { DeviceProfile } from '../capability/profile.ts';
import { isMainToWorker, type MainToWorker, type WorkerToMain } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

const MODEL_ID = 'LiquidAI/LFM2.5-VL-1.6B-ONNX';
const MODEL_BASE = `https://huggingface.co/${MODEL_ID}/resolve/main`;

// Transformers.js manages model fetching + caching itself; allow remote models.
env.allowLocalModels = false;

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- transformers.js APIs are loosely typed */
interface LoadedModel {
  processor: any;
  model: any;
}

let loaded: LoadedModel | null = null;
let loadPromise: Promise<LoadedModel> | null = null;
let plans: BackendPlan[] = [];
let activeBackend: string | null = null;
let activeId: string | null = null;
let abortRequested = false;

function post(message: WorkerToMain): void {
  self.postMessage(message);
}

function imageBitmapToRawImage(bitmap: ImageBitmap): RawImage {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return new RawImage(new Uint8ClampedArray(data), width, height, 4).rgb();
}

function onProgress(p: any): void {
  const progress: unknown = p?.progress;
  if (typeof progress === 'number') {
    post({ type: 'load-progress', stage: 'creating-sessions', fraction: progress / 100 });
  }
}

// The repo ships processor settings in processor_config.json and has NO
// preprocessor_config.json, so AutoProcessor.from_pretrained (which fetches
// preprocessor_config.json with fatal=true) 404s. Build the processor manually.
async function buildProcessor(): Promise<any> {
  const [procCfg, chatTemplate, tokenizer] = await Promise.all([
    fetch(`${MODEL_BASE}/processor_config.json`).then((r) => r.json()),
    fetch(`${MODEL_BASE}/chat_template.jinja`)
      .then((r) => (r.ok ? r.text() : ''))
      .catch(() => ''),
    AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback: onProgress }),
  ]);
  const imageProcessor = new Lfm2VlImageProcessor(procCfg.image_processor ?? procCfg);
  const ProcessorCtor = Lfm2VlProcessor as any;
  return new ProcessorCtor(
    procCfg,
    { image_processor: imageProcessor, tokenizer },
    chatTemplate || undefined,
  );
}

async function loadModel(plan: BackendPlan): Promise<any> {
  return AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
    dtype: plan.dtype as any,
    device: plan.device,
    progress_callback: onProgress,
  });
}

async function ensureLoaded(): Promise<LoadedModel> {
  if (loaded) return loaded;
  loadPromise ??= (async (): Promise<LoadedModel> => {
    post({ type: 'load-progress', stage: 'reading-cache', fraction: 0 });
    const processor = await buildProcessor();
    let lastError: unknown = null;
    for (const plan of plans) {
      try {
        const model = await loadModel(plan);
        activeBackend = plan.label;
        console.info(`[faturlens] inference backend: ${plan.label}`);
        loaded = { processor, model };
        return loaded;
      } catch (error) {
        lastError = error;
        console.warn(`[faturlens] backend "${plan.label}" failed, trying next`, error);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('No inference backend could be loaded');
  })();
  return loadPromise;
}

async function handleLoad(profile: DeviceProfile): Promise<void> {
  const selection = selectBackend(profile);
  plans = [selection.primary, ...(selection.fallback ? [selection.fallback] : [])];
  await ensureLoaded();
  post({ type: 'load-progress', stage: 'warming-up', fraction: 1 });
  post({ type: 'ready', ...(activeBackend ? { backend: activeBackend } : {}) });
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
  activeId = message.id;
  abortRequested = false;

  try {
    const { processor, model } = await ensureLoaded();
    const firstImage = message.images[0];
    const images = firstImage ? [imageBitmapToRawImage(firstImage)] : [];

    const messages = [
      {
        role: 'user',
        content: [
          ...(images.length > 0 ? [{ type: 'image' }] : []),
          { type: 'text', text: message.prompt },
        ],
      },
    ];

    const text = processor.apply_chat_template(messages, { add_generation_prompt: true });
    // Lfm2VlProcessor signature is (images, text).
    const inputs = await processor(images, text);

    const start = performance.now();
    let prefillMs = 0;
    let tokenCount = 0;
    let fullText = '';
    const streamer = new TextStreamer(processor.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (chunk: string) => {
        if (abortRequested) return;
        if (prefillMs === 0) prefillMs = performance.now() - start;
        tokenCount += 1;
        fullText += chunk;
        post({ type: 'token', id: message.id, text: chunk });
      },
    });

    await model.generate({
      ...inputs,
      max_new_tokens: Math.min(message.maxNewTokens, 4096),
      do_sample: false,
      streamer,
    });

    const decodeMs = performance.now() - start - prefillMs;
    post({
      type: 'done',
      id: message.id,
      fullText: fullText.trim(),
      stats: {
        prefillMs,
        decodeMs,
        tokensPerSecond: decodeMs > 0 ? (tokenCount / decodeMs) * 1000 : 0,
        peakMemoryEstimateMB: 0,
      },
    });
  } catch (error) {
    post({
      type: 'error',
      id: message.id,
      message: error instanceof Error ? error.message : String(error),
      recoverable: true,
    });
  } finally {
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
      loaded = null;
      loadPromise = null;
      return;
    default:
      return;
  }
}

self.addEventListener('message', (event: MessageEvent) => {
  if (!isMainToWorker(event.data)) return;
  void handleMessage(event.data).catch((error: unknown) => {
    post({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
      recoverable: false,
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
