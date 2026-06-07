import { describe, expect, it } from 'vitest';
import type { DeviceProfile } from '../capability/profile.ts';
import { InferenceClient, type WorkerLike } from './client.ts';
import type { GenerationStats, MainToWorker, WorkerToMain } from './protocol.ts';

const stats: GenerationStats = {
  prefillMs: 1,
  decodeMs: 2,
  tokensPerSecond: 3,
  peakMemoryEstimateMB: 4,
};

const fakeProfile = { executionProvider: 'wasm' } as unknown as DeviceProfile;

class FakeWorker implements WorkerLike {
  sent: MainToWorker[] = [];
  terminated = false;
  private listener: ((event: MessageEvent) => void) | null = null;

  postMessage(message: MainToWorker): void {
    this.sent.push(message);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') this.listener = listener;
  }
  terminate(): void {
    this.terminated = true;
  }
  emit(message: WorkerToMain): void {
    this.listener?.({ data: message } as MessageEvent);
  }
}

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const token of iterable) out.push(token);
  return out;
}

describe('InferenceClient', () => {
  it('resolves load() when the worker reports ready', async () => {
    const worker = new FakeWorker();
    const client = new InferenceClient(worker);
    const ready = client.load(fakeProfile);
    expect(worker.sent[0]).toEqual({ type: 'load', profile: fakeProfile });
    worker.emit({ type: 'ready' });
    await expect(ready).resolves.toBeUndefined();
  });

  it('streams tokens and resolves completed on done', async () => {
    const worker = new FakeWorker();
    const client = new InferenceClient(worker);
    const handle = client.infer({ images: [], prompt: 'p' });

    worker.emit({ type: 'token', id: handle.id, text: 'Hello ' });
    worker.emit({ type: 'token', id: handle.id, text: 'world' });
    worker.emit({ type: 'done', id: handle.id, fullText: 'Hello world', stats });

    expect(await collect(handle)).toEqual(['Hello ', 'world']);
    await expect(handle.completed).resolves.toEqual({ fullText: 'Hello world', stats });
  });

  it('runs a single inference at a time and queues the rest', async () => {
    const worker = new FakeWorker();
    const client = new InferenceClient(worker);
    const first = client.infer({ images: [], prompt: 'a' });
    const second = client.infer({ images: [], prompt: 'b' });

    const inferMessages = () => worker.sent.filter((m) => m.type === 'infer');
    expect(inferMessages()).toHaveLength(1);

    worker.emit({ type: 'done', id: first.id, fullText: 'A', stats });
    await first.completed;

    expect(inferMessages()).toHaveLength(2);
    worker.emit({ type: 'done', id: second.id, fullText: 'B', stats });
    await expect(second.completed).resolves.toEqual({ fullText: 'B', stats });
  });

  it('rejects completed when the worker reports an error for the active job', async () => {
    const worker = new FakeWorker();
    const client = new InferenceClient(worker);
    const handle = client.infer({ images: [], prompt: 'p' });
    worker.emit({ type: 'error', id: handle.id, message: 'OOM', recoverable: true });
    await expect(handle.completed).rejects.toThrow('OOM');
  });

  it('caps maxNewTokens at the ceiling', () => {
    const worker = new FakeWorker();
    const client = new InferenceClient(worker);
    client.infer({ images: [], prompt: 'p', maxNewTokens: 99999 });
    const msg = worker.sent.find((m) => m.type === 'infer');
    expect(msg?.type === 'infer' && msg.maxNewTokens).toBe(4096);
  });

  it('dispose rejects queued jobs and terminates the worker', async () => {
    const worker = new FakeWorker();
    const client = new InferenceClient(worker);
    const handle = client.infer({ images: [], prompt: 'p' });
    client.dispose();
    await expect(handle.completed).rejects.toThrow(/disposed/);
    expect(worker.terminated).toBe(true);
  });
});
