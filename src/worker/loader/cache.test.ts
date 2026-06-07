import { describe, expect, it } from 'vitest';
import { getFile, hasFile, putFile, type CacheLike } from './cache.ts';
import { hfUrl } from './manifest.ts';

const keyOf = (req: RequestInfo | URL): string =>
  typeof req === 'string' ? req : req instanceof URL ? req.href : req.url;

function makeCache(): CacheLike & { store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    match: (req) => {
      const bytes = store.get(keyOf(req));
      return Promise.resolve(bytes ? new Response(bytes.slice()) : undefined);
    },
    put: async (req, res) => {
      const ab = await res.arrayBuffer();
      store.set(keyOf(req), new Uint8Array(ab));
    },
    delete: (req) => Promise.resolve(store.delete(keyOf(req))),
    keys: () => Promise.resolve([]),
  };
}

describe('cache', () => {
  it('round-trips a non-manifest file by content', async () => {
    const cache = makeCache();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    await putFile('misc/blob.bin', bytes, cache);
    expect(await hasFile('misc/blob.bin', cache)).toBe(true);
    const read = await getFile('misc/blob.bin', cache);
    expect(read && Array.from(read)).toEqual([1, 2, 3, 4]);
  });

  it('reports a miss for an absent file', async () => {
    const cache = makeCache();
    expect(await hasFile('misc/none.bin', cache)).toBe(false);
    expect(await getFile('misc/none.bin', cache)).toBeNull();
  });

  it('evicts and reports a miss when a cached entry size is corrupt', async () => {
    const cache = makeCache();
    // config.json is pinned at 2376 bytes; store a truncated copy.
    const corrupt = new Uint8Array(10);
    cache.store.set(hfUrl('config.json'), corrupt);

    const read = await getFile('config.json', cache);
    expect(read).toBeNull();
    expect(cache.store.has(hfUrl('config.json'))).toBe(false);
  });

  it('returns a manifest file whose size matches', async () => {
    const cache = makeCache();
    const good = new Uint8Array(2376);
    cache.store.set(hfUrl('config.json'), good);
    const read = await getFile('config.json', cache);
    expect(read?.byteLength).toBe(2376);
  });
});
