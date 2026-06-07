// Model acquisition orchestrator. ensureModel resolves once every manifest
// entry is cached and verified. Idempotent: already-cached, size-verified files
// are never refetched.

import { getFile, openModelCache, putFile, type CacheLike } from './cache.ts';
import { fetchModelFile } from './fetcher.ts';
import { MODEL_MANIFEST, type ManifestEntry } from './manifest.ts';

export interface ModelLoadProgress {
  stage: 'checking' | 'downloading' | 'done';
  /** The file currently being downloaded, if any. */
  file?: string;
  fileReceived: number;
  fileTotal: number;
  overallReceived: number;
  overallTotal: number;
  overallFraction: number;
  /** True once at least one file has been resumed mid-download. */
  resumed: boolean;
}

export interface EnsureModelOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ModelLoadProgress) => void;
  cache?: CacheLike;
  fetchImpl?: typeof fetch;
  /** Manifest override, primarily for tests. Defaults to MODEL_MANIFEST. */
  manifest?: readonly ManifestEntry[];
}

/**
 * Request persistent storage so the browser will not evict the cached model
 * under pressure. Returns the grant result (false if unsupported or denied).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const nav = (
    globalThis as {
      navigator?: {
        storage?: { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> };
      };
    }
  ).navigator;
  const storage = nav?.storage;
  if (!storage?.persist || !storage.persisted) return false;
  try {
    if (await storage.persisted()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
}

/** Resolve when the full model is cached and size-verified. */
export async function ensureModel(opts: EnsureModelOptions = {}): Promise<void> {
  const cache = opts.cache ?? (await openModelCache());
  const manifest = opts.manifest ?? MODEL_MANIFEST;
  const overallTotal = manifest.reduce((sum, entry) => sum + entry.bytes, 0);
  let overallReceived = 0;
  let resumed = false;

  // Pass 1: account for already-cached, verified files.
  const missing: ManifestEntry[] = [];
  for (const entry of manifest) {
    if (opts.signal?.aborted) throw abortError(opts.signal);
    const cached = await getFile(entry.path, cache);
    if (cached) {
      overallReceived += entry.bytes;
    } else {
      missing.push(entry);
    }
    opts.onProgress?.({
      stage: 'checking',
      fileReceived: 0,
      fileTotal: 0,
      overallReceived,
      overallTotal,
      overallFraction: overallTotal > 0 ? overallReceived / overallTotal : 1,
      resumed,
    });
  }

  // Pass 2: download what is missing.
  for (const entry of missing) {
    if (opts.signal?.aborted) throw abortError(opts.signal);
    const baseReceived = overallReceived;
    let lastFileReceived = 0;

    const bytes = await fetchModelFile(entry, {
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      onProgress: (p) => {
        // A non-zero start of a fresh download fraction implies a resume.
        if (p.received < lastFileReceived) resumed = true;
        lastFileReceived = p.received;
        opts.onProgress?.({
          stage: 'downloading',
          file: entry.path,
          fileReceived: p.received,
          fileTotal: p.total,
          overallReceived: baseReceived + p.received,
          overallTotal,
          overallFraction: overallTotal > 0 ? (baseReceived + p.received) / overallTotal : 1,
          resumed,
        });
      },
    });

    await putFile(entry.path, bytes, cache);
    overallReceived = baseReceived + entry.bytes;
  }

  opts.onProgress?.({
    stage: 'done',
    fileReceived: 0,
    fileTotal: 0,
    overallReceived: overallTotal,
    overallTotal,
    overallFraction: 1,
    resumed,
  });
}

function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error) return reason;
  return new DOMException('Model loading was aborted', 'AbortError');
}
