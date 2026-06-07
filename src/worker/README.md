# worker

Dedicated inference Web Worker and ORT sessions.

**Invariant:** all `onnxruntime-web` sessions live here. The main thread never
touches ORT.

## Modules

- `protocol.ts` — typed, guarded message union between main thread and worker.
- `sessions.ts` — creates the three ORT sessions (FP16 encoder, Q4 decoder, FP16
  embeddings) from cached bytes, wiring the WebGPU or WASM execution provider.
  `ort.env.wasm.numThreads = 1` on the WebGPU path per the official recipe.
- `generate.ts` — greedy (temperature 0) autoregressive loop with an explicit KV
  cache. Streams tokens and emits timing stats.
- `worker.ts` — entry point. Loads tokenizer (transformers, tokenizer only) +
  config, encodes image tiles, runs generation. Single in-flight inference;
  concurrent infer messages are rejected with a typed error.
- `client.ts` — main-thread `InferenceClient`: Promise + async-iterator API,
  request queueing, abort, dispose.
- `loader/` — model acquisition and caching (Phase 03).

## Memory budget & disposal

KV-cache tensors are rolled over each decode step and the previous step's
tensors are **explicitly disposed** (`Tensor.dispose()`); attention/position
tensors and the per-step embedding are disposed every iteration. Image-embedding
tensors are disposed in the infer `finally` block. The design goal: the worker
survives 50+ consecutive generations with flat memory — verify with the
DevTools performance monitor during a soak run via `?harness`.

## I/O name caveat

Decoder I/O names follow the transformers.js / Optimum export convention
(`inputs_embeds`, `attention_mask`, `position_ids`,
`past_key_values.<n>.{key,value}` → `present.<n>.{key,value}`, `logits`). Layer
count, KV heads, and head dim are read from `config.json`. Validate against a
live WebGPU run when first bringing up the model.
