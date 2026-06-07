import { describe, expect, it, vi } from 'vitest';
import { fetchModelFile } from './fetcher.ts';
import type { ManifestEntry } from './manifest.ts';

const entry: ManifestEntry = { path: 'test/blob.bin', bytes: 8, role: 'config' };

interface FakeResponseSpec {
  status: number;
  chunks: Uint8Array[];
  /** Reject the read() at this chunk index (once). */
  errorAtChunk?: number;
}

function fakeResponse(spec: FakeResponseSpec): Response {
  let index = 0;
  let errored = false;
  const reader = {
    read(): Promise<ReadableStreamReadResult<Uint8Array>> {
      if (spec.errorAtChunk !== undefined && index === spec.errorAtChunk && !errored) {
        errored = true;
        return Promise.reject(new Error('connection dropped'));
      }
      const chunk = spec.chunks[index];
      if (chunk === undefined) return Promise.resolve({ done: true, value: undefined });
      index += 1;
      return Promise.resolve({ done: false, value: chunk });
    },
  };
  return {
    status: spec.status,
    body: { getReader: () => reader },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as unknown as Response;
}

describe('fetchModelFile', () => {
  it('downloads a file in chunks and reports progress', async () => {
    const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const fetchImpl = vi.fn(() =>
      Promise.resolve(fakeResponse({ status: 200, chunks: [data.slice(0, 4), data.slice(4)] })),
    ) as unknown as typeof fetch;

    const progress: number[] = [];
    const result = await fetchModelFile(entry, {
      fetchImpl,
      onProgress: (p) => progress.push(p.received),
    });

    expect(Array.from(result)).toEqual(Array.from(data));
    expect(progress).toContain(8);
  });

  it('resumes from the received offset after a mid-file failure', async () => {
    const data = new Uint8Array([10, 11, 12, 13, 14, 15, 16, 17]);
    const ranges: (string | undefined)[] = [];

    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const range = headers.Range;
      ranges.push(range);
      if (range === undefined) {
        // First attempt: deliver 4 bytes, then drop the connection.
        return Promise.resolve(
          fakeResponse({ status: 200, chunks: [data.slice(0, 4)], errorAtChunk: 1 }),
        );
      }
      const start = Number.parseInt(range.replace('bytes=', ''), 10);
      return Promise.resolve(fakeResponse({ status: 206, chunks: [data.slice(start)] }));
    }) as unknown as typeof fetch;

    const result = await fetchModelFile(entry, { fetchImpl });

    expect(Array.from(result)).toEqual(Array.from(data));
    expect(ranges[0]).toBeUndefined();
    expect(ranges[1]).toBe('bytes=4-');
  });

  it('gives up after exceeding maxRetries', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        fakeResponse({ status: 200, chunks: [new Uint8Array([1])], errorAtChunk: 0 }),
      ),
    ) as unknown as typeof fetch;

    await expect(fetchModelFile(entry, { fetchImpl, maxRetries: 2 })).rejects.toThrow(
      /connection dropped/,
    );
    // 1 initial attempt + 2 retries = 3 calls.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('aborts promptly when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(fetchModelFile(entry, { fetchImpl, signal: controller.signal })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
