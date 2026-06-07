// Streaming model fetcher with progress callbacks and Range-request resume.
//
// A single fetchModelFile call survives mid-file connection drops: progress is
// tracked in `received`, and on a stream error the next attempt issues a
// `Range: bytes=<received>-` request and continues filling the same buffer.

import { hfUrl, type ManifestEntry } from './manifest.ts';

export interface FetchProgress {
  path: string;
  received: number;
  total: number;
  /** received / total for this file, clamped to [0, 1]. */
  fraction: number;
}

export interface FetchOptions {
  signal?: AbortSignal;
  onProgress?: (progress: FetchProgress) => void;
  /** Max resume attempts after a mid-file failure. Default 5. */
  maxRetries?: number;
  /** Injectable fetch for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function emit(opts: FetchOptions, path: string, received: number, total: number): void {
  opts.onProgress?.({
    path,
    received,
    total,
    fraction: total > 0 ? Math.min(1, received / total) : 1,
  });
}

/**
 * Download a single manifest file into a Uint8Array, resuming via Range
 * requests if the connection drops. Honors an AbortSignal.
 */
export async function fetchModelFile(
  entry: ManifestEntry,
  opts: FetchOptions = {},
): Promise<Uint8Array> {
  const doFetch = opts.fetchImpl ?? fetch;
  const maxRetries = opts.maxRetries ?? 5;
  const total = entry.bytes;
  const buffer = new Uint8Array(total);
  const url = hfUrl(entry.path);

  let received = 0;
  let attempts = 0;

  emit(opts, entry.path, received, total);

  while (received < total) {
    if (opts.signal?.aborted) throw toAbortError(opts.signal);

    const headers: Record<string, string> = {};
    if (received > 0) headers.Range = `bytes=${String(received)}-`;

    try {
      const response = await doFetch(url, {
        headers,
        ...(opts.signal ? { signal: opts.signal } : {}),
      });
      if (response.status !== 200 && response.status !== 206) {
        throw new Error(`Unexpected status ${String(response.status)} fetching ${entry.path}`);
      }

      if (!response.body) {
        // Environment without streaming bodies: take the whole buffer at once.
        const chunk = new Uint8Array(await response.arrayBuffer());
        buffer.set(chunk, received);
        received += chunk.byteLength;
        emit(opts, entry.path, received, total);
        continue;
      }

      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer.set(value, received);
        received += value.byteLength;
        emit(opts, entry.path, received, total);
      }
    } catch (error) {
      if (opts.signal?.aborted) throw toAbortError(opts.signal);
      attempts += 1;
      if (attempts > maxRetries) {
        throw error instanceof Error
          ? error
          : new Error(`Fetch failed for ${entry.path}: ${String(error)}`);
      }
      // Fall through; the loop re-issues a Range request from `received`.
    }
  }

  return buffer;
}

function toAbortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error) return reason;
  return new DOMException('The model download was aborted', 'AbortError');
}
