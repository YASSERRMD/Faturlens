// Main-thread side of the inference worker. Wraps the worker in a Promise +
// async-iterator API and enforces single-in-flight execution by queueing
// requests (the worker rejects concurrency; queueing is the main thread's job).

import type { DeviceProfile } from '../capability/profile.ts';
import {
  isWorkerToMain,
  MAX_NEW_TOKENS_CEILING,
  type GenerationStats,
  type MainToWorker,
} from './protocol.ts';

export interface WorkerLike {
  postMessage: (message: MainToWorker, transfer?: Transferable[]) => void;
  addEventListener: (type: string, listener: (event: MessageEvent) => void) => void;
  terminate: () => void;
}

export interface InferenceRequest {
  images: ImageBitmap[];
  prompt: string;
  maxNewTokens?: number;
}

export interface InferenceResult {
  fullText: string;
  stats: GenerationStats;
}

export interface InferenceHandle extends AsyncIterable<string> {
  readonly id: string;
  readonly completed: Promise<InferenceResult>;
  abort: () => void;
}

/** Async stream that buffers tokens until a consumer reads them. */
class TokenStream implements AsyncIterable<string> {
  private buffer: string[] = [];
  private waiting: ((result: IteratorResult<string>) => void)[] = [];
  private done = false;
  private failure: Error | null = null;

  push(token: string): void {
    const resolve = this.waiting.shift();
    if (resolve) resolve({ value: token, done: false });
    else this.buffer.push(token);
  }

  end(): void {
    this.done = true;
    for (const resolve of this.waiting) resolve({ value: undefined, done: true });
    this.waiting = [];
  }

  fail(error: Error): void {
    this.failure = error;
    this.end();
  }

  [Symbol.asyncIterator](): AsyncIterator<string> {
    return {
      next: (): Promise<IteratorResult<string>> => {
        if (this.failure) return Promise.reject(this.failure);
        const next = this.buffer.shift();
        if (next !== undefined) return Promise.resolve({ value: next, done: false });
        if (this.done) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.waiting.push(resolve));
      },
    };
  }
}

interface Job {
  id: string;
  request: InferenceRequest;
  stream: TokenStream;
  resolve: (result: InferenceResult) => void;
  reject: (error: Error) => void;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `infer-${String(idCounter)}`;
}

/** Spawn the real inference worker and wrap it in an InferenceClient. */
export function createInferenceClient(): InferenceClient {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return new InferenceClient(worker as unknown as WorkerLike);
}

export class InferenceClient {
  /** Optional model-load progress sink (stage + fraction in [0,1]). */
  onLoadProgress: ((stage: string, fraction: number) => void) | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private queue: Job[] = [];
  private active: Job | null = null;
  private disposed = false;

  constructor(private readonly worker: WorkerLike) {
    this.worker.addEventListener('message', (event: MessageEvent) => {
      this.handleMessage(event.data);
    });
  }

  load(profile: DeviceProfile): Promise<void> {
    this.readyPromise ??= new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.worker.postMessage({ type: 'load', profile });
    return this.readyPromise;
  }

  infer(request: InferenceRequest): InferenceHandle {
    if (this.disposed) throw new Error('InferenceClient has been disposed');
    const id = nextId();
    const stream = new TokenStream();
    let resolve!: (result: InferenceResult) => void;
    let reject!: (error: Error) => void;
    const completed = new Promise<InferenceResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    // Surface terminal failures to the awaiter even if no one iterates tokens.
    completed.catch(() => undefined);

    const job: Job = { id, request, stream, resolve, reject };
    this.queue.push(job);
    this.pump();

    return {
      id,
      completed,
      abort: () => {
        this.abort(id);
      },
      [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
    };
  }

  abort(id: string): void {
    this.worker.postMessage({ type: 'abort', id });
  }

  dispose(): void {
    this.disposed = true;
    this.worker.postMessage({ type: 'dispose' });
    const aborted = new Error('InferenceClient disposed');
    for (const job of this.queue) job.reject(aborted);
    this.queue = [];
    if (this.active) {
      this.active.reject(aborted);
      this.active.stream.fail(aborted);
      this.active = null;
    }
    this.worker.terminate();
  }

  private pump(): void {
    if (this.active || this.queue.length === 0) return;
    const job = this.queue.shift();
    if (!job) return;
    this.active = job;
    const maxNewTokens = Math.min(job.request.maxNewTokens ?? 2048, MAX_NEW_TOKENS_CEILING);
    this.worker.postMessage(
      {
        type: 'infer',
        id: job.id,
        images: job.request.images,
        prompt: job.request.prompt,
        maxNewTokens,
      },
      job.request.images,
    );
  }

  private handleMessage(data: unknown): void {
    if (!isWorkerToMain(data)) return;
    switch (data.type) {
      case 'ready':
        this.resolveReady?.();
        return;
      case 'token':
        if (this.active?.id === data.id) this.active.stream.push(data.text);
        return;
      case 'done':
        if (this.active?.id === data.id) {
          this.active.resolve({ fullText: data.fullText, stats: data.stats });
          this.active.stream.end();
          this.active = null;
          this.pump();
        }
        return;
      case 'error': {
        const error = new Error(data.message);
        if (data.id && this.active?.id === data.id) {
          this.active.reject(error);
          this.active.stream.fail(error);
          this.active = null;
          this.pump();
        } else if (!data.id) {
          this.rejectReady?.(error);
        }
        return;
      }
      case 'load-progress':
        this.onLoadProgress?.(data.stage, data.fraction);
        return;
      default:
        return;
    }
  }
}
