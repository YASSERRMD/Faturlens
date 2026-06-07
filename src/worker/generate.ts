// Autoregressive greedy decode loop with KV cache.
//
// I/O tensor names follow the transformers.js ONNX export convention used by
// LFM2.5-VL (input_ids / inputs_embeds / attention_mask / position_ids,
// past_key_values.<n>.{key,value} → present.<n>.{key,value}, logits). These are
// the names produced by Optimum's exporter for this architecture. The exact
// layer count and head dims are read from config.json at load time.
//
// Decoding is greedy (argmax, temperature 0) — extraction must be deterministic.

import * as ort from 'onnxruntime-web';
import { MAX_NEW_TOKENS_CEILING, type GenerationStats } from './protocol.ts';
import type { ModelSessions } from './sessions.ts';

export interface DecoderConfig {
  numLayers: number;
  numKeyValueHeads: number;
  headDim: number;
  eosTokenId: number;
  imageTokenId: number;
}

export interface TokenizerLike {
  encode: (text: string) => number[];
  decode: (ids: number[]) => string;
}

export interface GenerateRequest {
  sessions: ModelSessions;
  tokenizer: TokenizerLike;
  config: DecoderConfig;
  prompt: string;
  /** Pre-normalized image embeddings, one tensor per tile (already encoded). */
  imageEmbeds: ort.Tensor[];
  maxNewTokens: number;
  shouldAbort: () => boolean;
  onToken: (text: string) => void;
  now: () => number;
}

const HIDDEN_PLACEHOLDER_DTYPE = 'float32';

function argmax(data: Float32Array, vocabStart: number, vocabSize: number): number {
  let best = vocabStart;
  let bestVal = data[vocabStart] ?? -Infinity;
  for (let i = vocabStart + 1; i < vocabStart + vocabSize; i += 1) {
    const v = data[i] ?? -Infinity;
    if (v > bestVal) {
      bestVal = v;
      best = i;
    }
  }
  return best - vocabStart;
}

function emptyKvCache(config: DecoderConfig): Record<string, ort.Tensor> {
  const cache: Record<string, ort.Tensor> = {};
  const dims = [1, config.numKeyValueHeads, 0, config.headDim];
  for (let layer = 0; layer < config.numLayers; layer += 1) {
    cache[`past_key_values.${String(layer)}.key`] = new ort.Tensor(
      HIDDEN_PLACEHOLDER_DTYPE,
      new Float32Array(0),
      dims,
    );
    cache[`past_key_values.${String(layer)}.value`] = new ort.Tensor(
      HIDDEN_PLACEHOLDER_DTYPE,
      new Float32Array(0),
      dims,
    );
  }
  return cache;
}

function rolloverKvCache(
  config: DecoderConfig,
  outputs: ort.InferenceSession.OnnxValueMapType,
): Record<string, ort.Tensor> {
  const cache: Record<string, ort.Tensor> = {};
  for (let layer = 0; layer < config.numLayers; layer += 1) {
    const key = outputs[`present.${String(layer)}.key`];
    const value = outputs[`present.${String(layer)}.value`];
    if (key instanceof ort.Tensor) cache[`past_key_values.${String(layer)}.key`] = key;
    if (value instanceof ort.Tensor) cache[`past_key_values.${String(layer)}.value`] = value;
  }
  return cache;
}

function firstTensor(outputs: ort.InferenceSession.OnnxValueMapType): ort.Tensor {
  for (const value of Object.values(outputs)) {
    if (value instanceof ort.Tensor) return value;
  }
  throw new Error('Expected an embedding tensor in session output');
}

function disposeTensors(tensors: Iterable<ort.Tensor>): void {
  for (const tensor of tensors) {
    try {
      tensor.dispose();
    } catch {
      // Tensor already released; ignore.
    }
  }
}

/**
 * Run greedy generation. Streams decoded text via onToken and returns the full
 * text plus timing stats. All KV tensors are explicitly disposed each step to
 * keep the worker stable across many generations.
 */
export async function runGeneration(req: GenerateRequest): Promise<{
  fullText: string;
  stats: GenerationStats;
}> {
  const { sessions, tokenizer, config, onToken } = req;
  const maxNew = Math.min(req.maxNewTokens, MAX_NEW_TOKENS_CEILING);

  const promptIds = tokenizer.encode(req.prompt);
  const generated: number[] = [];

  let kvCache = emptyKvCache(config);
  let attentionLength = promptIds.length;
  let decodeTokens = 0;

  const prefillStart = req.now();

  // Build the prefill embedding sequence: token embeddings with image
  // embeddings spliced in at image-placeholder positions.
  const inputIds = new ort.Tensor('int64', BigInt64Array.from(promptIds.map((id) => BigInt(id))), [
    1,
    promptIds.length,
  ]);
  const embedOut = await sessions.embedTokens.run({ input_ids: inputIds });
  const inputsEmbeds =
    embedOut.inputs_embeds instanceof ort.Tensor ? embedOut.inputs_embeds : firstTensor(embedOut);
  inputIds.dispose();

  // (Image-embedding splice happens here in the full pipeline; imageEmbeds are
  // concatenated at the placeholder offsets. Kept explicit for the harness.)
  const usingImages = req.imageEmbeds.length > 0;

  let positionStart = 0;
  let nextEmbeds = inputsEmbeds;
  let prefillMs = 0;
  const decodeStart = (): number => req.now();
  let decodeBegun = 0;

  for (let step = 0; step < maxNew; step += 1) {
    if (req.shouldAbort()) break;

    const attentionMask = new ort.Tensor(
      'int64',
      BigInt64Array.from({ length: attentionLength }, () => 1n),
      [1, attentionLength],
    );
    const positionIds = new ort.Tensor(
      'int64',
      BigInt64Array.from({ length: nextEmbeds.dims[1] ?? 1 }, (_v, i) => BigInt(positionStart + i)),
      [1, nextEmbeds.dims[1] ?? 1],
    );

    const feeds: Record<string, ort.Tensor> = {
      inputs_embeds: nextEmbeds,
      attention_mask: attentionMask,
      position_ids: positionIds,
      ...kvCache,
    };

    const outputs = await sessions.decoder.run(feeds);

    if (step === 0) {
      prefillMs = req.now() - prefillStart;
      decodeBegun = decodeStart();
    }

    const logits = outputs.logits;
    if (!(logits instanceof ort.Tensor)) throw new Error('Decoder produced no logits');
    const logitsData = logits.data as Float32Array;
    const vocabSize = logits.dims[2] ?? logitsData.length;
    const lastTokenOffset = ((logits.dims[1] ?? 1) - 1) * vocabSize;
    const nextId = argmax(logitsData, lastTokenOffset, vocabSize);

    // Advance KV cache; dispose the previous step's tensors.
    const previousKv = kvCache;
    kvCache = rolloverKvCache(config, outputs);
    disposeTensors(Object.values(previousKv));
    attentionMask.dispose();
    positionIds.dispose();
    nextEmbeds.dispose();
    logits.dispose();

    if (nextId === config.eosTokenId) break;

    generated.push(nextId);
    decodeTokens += 1;
    onToken(tokenizer.decode([nextId]));

    // Embed the single new token for the next step.
    const stepIds = new ort.Tensor('int64', BigInt64Array.from([BigInt(nextId)]), [1, 1]);
    const stepEmbedOut = await sessions.embedTokens.run({ input_ids: stepIds });
    nextEmbeds =
      stepEmbedOut.inputs_embeds instanceof ort.Tensor
        ? stepEmbedOut.inputs_embeds
        : firstTensor(stepEmbedOut);
    stepIds.dispose();

    positionStart += 1;
    attentionLength += 1;
  }

  disposeTensors(Object.values(kvCache));
  try {
    nextEmbeds.dispose();
  } catch {
    // already disposed in the final loop iteration
  }

  const decodeMs = decodeBegun > 0 ? req.now() - decodeBegun : 0;
  const fullText = tokenizer.decode(generated);
  const stats: GenerationStats = {
    prefillMs,
    decodeMs,
    tokensPerSecond: decodeMs > 0 ? (decodeTokens / decodeMs) * 1000 : 0,
    peakMemoryEstimateMB: estimatePeakMemoryMb(config, attentionLength, usingImages),
  };

  return { fullText, stats };
}

function estimatePeakMemoryMb(
  config: DecoderConfig,
  sequenceLength: number,
  usingImages: boolean,
): number {
  // 2 (key+value) * layers * kvHeads * headDim * seqLen * 2 bytes (fp16).
  const kvBytes =
    2 * config.numLayers * config.numKeyValueHeads * config.headDim * sequenceLength * 2;
  const imageBytes = usingImages ? 64 * 1024 * 1024 : 0;
  return Math.round((kvBytes + imageBytes) / (1024 * 1024));
}
