import { describe, expect, it } from 'vitest';
import { isMainToWorker, isWorkerToMain } from './protocol.ts';

describe('isMainToWorker', () => {
  it('accepts a well-formed infer message', () => {
    expect(
      isMainToWorker({ type: 'infer', id: 'a', images: [], prompt: 'hi', maxNewTokens: 512 }),
    ).toBe(true);
  });

  it('accepts load, abort, and dispose', () => {
    expect(isMainToWorker({ type: 'load', profile: {} })).toBe(true);
    expect(isMainToWorker({ type: 'abort', id: 'x' })).toBe(true);
    expect(isMainToWorker({ type: 'dispose' })).toBe(true);
  });

  it('rejects malformed messages', () => {
    expect(isMainToWorker({ type: 'infer', id: 'a' })).toBe(false);
    expect(isMainToWorker({ type: 'load' })).toBe(false);
    expect(isMainToWorker({ type: 'nope' })).toBe(false);
    expect(isMainToWorker(null)).toBe(false);
    expect(isMainToWorker('string')).toBe(false);
  });
});

describe('isWorkerToMain', () => {
  it('accepts streaming and terminal messages', () => {
    expect(isWorkerToMain({ type: 'ready' })).toBe(true);
    expect(isWorkerToMain({ type: 'token', id: 'a', text: 'x' })).toBe(true);
    expect(
      isWorkerToMain({
        type: 'done',
        id: 'a',
        fullText: 'x',
        stats: { prefillMs: 1, decodeMs: 2, tokensPerSecond: 3, peakMemoryEstimateMB: 4 },
      }),
    ).toBe(true);
    expect(isWorkerToMain({ type: 'error', message: 'boom', recoverable: false })).toBe(true);
    expect(isWorkerToMain({ type: 'load-progress', stage: 'warming-up', fraction: 0.5 })).toBe(
      true,
    );
  });

  it('rejects malformed messages', () => {
    expect(isWorkerToMain({ type: 'token', id: 'a' })).toBe(false);
    expect(isWorkerToMain({ type: 'done', id: 'a', fullText: 'x' })).toBe(false);
    expect(isWorkerToMain({ type: 'error', message: 'x' })).toBe(false);
    expect(isWorkerToMain(undefined)).toBe(false);
  });
});
