// Cache API storage for model artifacts. Integrity is verified by byte-size
// comparison against the manifest on every read; a mismatch evicts the entry
// and reports a miss so the orchestrator refetches it.

import { CACHE_NAME, findManifestEntry, hfUrl } from './manifest.ts';

/** Minimal structural subset of the Cache API, for injectable testing. */
export interface CacheLike {
  match: (request: RequestInfo | URL) => Promise<Response | undefined>;
  put: (request: RequestInfo | URL, response: Response) => Promise<void>;
  delete: (request: RequestInfo | URL) => Promise<boolean>;
  keys: () => Promise<readonly Request[]>;
}

function cacheKey(path: string): string {
  return hfUrl(path);
}

/** Open the model cache. */
export async function openModelCache(): Promise<CacheLike> {
  return caches.open(CACHE_NAME);
}

export async function hasFile(path: string, cache: CacheLike): Promise<boolean> {
  const match = await cache.match(cacheKey(path));
  return match !== undefined;
}

/**
 * Read a cached file. Returns null if absent, or if its byte size does not
 * match the manifest (in which case the corrupt entry is evicted first).
 */
export async function getFile(path: string, cache: CacheLike): Promise<Uint8Array | null> {
  const response = await cache.match(cacheKey(path));
  if (!response) return null;

  const bytes = new Uint8Array(await response.arrayBuffer());
  const entry = findManifestEntry(path);
  if (entry && bytes.byteLength !== entry.bytes) {
    await cache.delete(cacheKey(path));
    return null;
  }
  return bytes;
}

export async function putFile(path: string, bytes: Uint8Array, cache: CacheLike): Promise<void> {
  // Copy into a standalone ArrayBuffer so Response owns its bytes.
  const body = bytes.slice();
  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bytes.byteLength),
    },
  });
  await cache.put(cacheKey(path), response);
}

export async function evictFile(path: string, cache: CacheLike): Promise<void> {
  await cache.delete(cacheKey(path));
}

/** Drop the entire model cache. */
export async function evictAll(): Promise<void> {
  await caches.delete(CACHE_NAME);
}
