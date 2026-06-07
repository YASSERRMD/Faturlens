import { describe, expect, it, vi } from 'vitest';
import { type CacheLike } from './cache.ts';
import { ensureModel } from './loader.ts';
import { hfUrl, type ManifestEntry } from './manifest.ts';

// Tiny manifest with paths absent from MODEL_MANIFEST, so the cache's
// size-integrity check is skipped and we can use small buffers.
const tinyManifest: readonly ManifestEntry[] = [
  { path: 'test/a.bin', bytes: 4, role: 'config' },
  { path: 'test/b.bin', bytes: 4, role: 'config' },
];

const keyOf = (req: RequestInfo | URL): string =>
  typeof req === 'string' ? req : req instanceof URL ? req.href : req.url;

function makeCache(seed: Record<string, Uint8Array> = {}): CacheLike & {
  store: Map<string, Uint8Array>;
} {
  const store = new Map<string, Uint8Array>(Object.entries(seed));
  return {
    store,
    match: (req) => {
      const bytes = store.get(keyOf(req));
      return Promise.resolve(bytes ? new Response(bytes.slice()) : undefined);
    },
    put: async (req, res) => {
      store.set(keyOf(req), new Uint8Array(await res.arrayBuffer()));
    },
    delete: (req) => Promise.resolve(store.delete(keyOf(req))),
    keys: () => Promise.resolve([]),
  };
}

function fetchReturning(bytes: Uint8Array): typeof fetch {
  return vi.fn(() =>
    Promise.resolve({
      status: 200,
      body: {
        getReader: () => {
          let sent = false;
          return {
            read: () =>
              sent
                ? Promise.resolve({ done: true, value: undefined })
                : ((sent = true), Promise.resolve({ done: false, value: bytes })),
          };
        },
      },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    }),
  ) as unknown as typeof fetch;
}

describe('ensureModel', () => {
  it('downloads missing files and caches them', async () => {
    const cache = makeCache();
    const fetchImpl = fetchReturning(new Uint8Array([9, 9, 9, 9]));
    await ensureModel({ cache, fetchImpl, manifest: tinyManifest });

    expect(cache.store.has(hfUrl('test/a.bin'))).toBe(true);
    expect(cache.store.has(hfUrl('test/b.bin'))).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('is idempotent: cached files are never refetched', async () => {
    const cache = makeCache({
      [hfUrl('test/a.bin')]: new Uint8Array([1, 1, 1, 1]),
      [hfUrl('test/b.bin')]: new Uint8Array([2, 2, 2, 2]),
    });
    const fetchImpl = fetchReturning(new Uint8Array([0, 0, 0, 0]));

    await ensureModel({ cache, fetchImpl, manifest: tinyManifest });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('only fetches the missing subset', async () => {
    const cache = makeCache({ [hfUrl('test/a.bin')]: new Uint8Array([1, 1, 1, 1]) });
    const fetchImpl = fetchReturning(new Uint8Array([7, 7, 7, 7]));

    await ensureModel({ cache, fetchImpl, manifest: tinyManifest });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports a terminal done progress event with full fraction', async () => {
    const cache = makeCache();
    const fetchImpl = fetchReturning(new Uint8Array([5, 5, 5, 5]));
    const stages: string[] = [];
    await ensureModel({
      cache,
      fetchImpl,
      manifest: tinyManifest,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages.at(-1)).toBe('done');
  });
});
