# worker/loader

Reliable model acquisition: get the bytes on disk and verified, offline-first.

## Modules

- `manifest.ts` — pinned artifact list (path, byte size, sha256 LFS oid, role)
  for `LiquidAI/LFM2.5-VL-1.6B-ONNX`. The WebGPU recipe: FP16 vision encoder
  (`embed_images_fp16`) + Q4 decoder + FP16 token embeddings, plus tokenizer and
  config files.
- `fetcher.ts` — streaming download with progress callbacks and **Range-request
  resume**. A single call survives mid-file connection drops by re-issuing
  `Range: bytes=<received>-` and continuing into the same buffer.
- `cache.ts` — Cache API storage. Integrity is a **byte-size comparison** on
  read; a mismatch evicts the entry and reports a miss.
- `loader.ts` — `ensureModel()` orchestrator (idempotent, abortable) and
  `requestPersistentStorage()`.

## Cache versioning & eviction

Cached under `faturlens-model-v1`. **Bump the version suffix** (`-v2`, …)
whenever the manifest changes — paths, sizes, or the artifact recipe — so stale
bytes are abandoned rather than served. `evictAll()` drops the whole cache;
`getFile()` self-heals individual corrupt entries by evicting on size mismatch.

Persistent storage is requested before the first download. If denied, the gate
warns the user that the cache may be evicted under memory pressure.
