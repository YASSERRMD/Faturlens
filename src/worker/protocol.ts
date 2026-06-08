// Typed message protocol between the main thread and the inference worker.
// Discriminated unions with runtime type guards so neither side trusts the wire.

import type { DeviceProfile } from '../capability/profile.ts';

export interface GenerationStats {
  prefillMs: number;
  decodeMs: number;
  tokensPerSecond: number;
  peakMemoryEstimateMB: number;
}

export type LoadStage = 'reading-cache' | 'creating-sessions' | 'warming-up';

export type MainToWorker =
  | { type: 'load'; profile: DeviceProfile }
  | { type: 'infer'; id: string; images: ImageBitmap[]; prompt: string; maxNewTokens: number }
  | { type: 'abort'; id: string }
  | { type: 'dispose' };

export type WorkerToMain =
  | { type: 'load-progress'; stage: LoadStage; fraction: number }
  | { type: 'ready'; backend?: string }
  | { type: 'token'; id: string; text: string }
  | { type: 'done'; id: string; fullText: string; stats: GenerationStats }
  | { type: 'error'; id?: string; message: string; recoverable: boolean };

/** Absolute ceiling on generated tokens, regardless of request. */
export const MAX_NEW_TOKENS_CEILING = 4096;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isMainToWorker(value: unknown): value is MainToWorker {
  if (!isObject(value)) return false;
  switch (value.type) {
    case 'load':
      return isObject(value.profile);
    case 'infer':
      return (
        typeof value.id === 'string' &&
        Array.isArray(value.images) &&
        typeof value.prompt === 'string' &&
        typeof value.maxNewTokens === 'number'
      );
    case 'abort':
      return typeof value.id === 'string';
    case 'dispose':
      return true;
    default:
      return false;
  }
}

export function isWorkerToMain(value: unknown): value is WorkerToMain {
  if (!isObject(value)) return false;
  switch (value.type) {
    case 'load-progress':
      return typeof value.stage === 'string' && typeof value.fraction === 'number';
    case 'ready':
      return true;
    case 'token':
      return typeof value.id === 'string' && typeof value.text === 'string';
    case 'done':
      return (
        typeof value.id === 'string' && typeof value.fullText === 'string' && isObject(value.stats)
      );
    case 'error':
      return typeof value.message === 'string' && typeof value.recoverable === 'boolean';
    default:
      return false;
  }
}
