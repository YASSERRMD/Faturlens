# perf

Performance hardening: honest estimates, recovery, and tuning. The decision
logic is pure and unit-tested; the worker/UI apply it.

## Modules

- `estimate.ts` — `benchmarkToTps()` turns a startup warmup (tokens/ms) into
  throughput; `estimatePageSeconds()` / `estimateBatchSeconds()` /
  `formatEstimate()` give upfront per-page and per-batch estimates shown before
  processing starts.
- `recovery.ts` — the WebGPU device-lost ladder: first loss recreates sessions;
  a **second loss within 10 minutes demotes to WASM**. The worker calls
  `onDeviceLost()` when it catches a device-lost error.
- `autotune.ts` — `suggestBudget()` proposes a smaller image token budget when
  WebGPU decode drops below 3 tok/s (user-confirmed before it is stored).

## Other hardening

- **WASM path** runs the full pipeline; the profile forces the WASM EP and the
  UI shows realistic minutes-per-page from the benchmark.
- **Runtime tile downscale**: `planTiles` already clamps to the device budget
  (Phase 05); over-budget pages are downscaled and noted on the page record.
- **Off-main-thread**: blob/canvas/tensor work runs in the workers, keeping
  main-thread tasks short during processing.
- **Resumable on tab close**: `store/resumable.ts` resets any `processing`
  document to `queued` on `beforeunload`, so an abrupt close never corrupts the
  queue.
- **Local-only telemetry**: per-stage timings render in `<StatsDrawer />`;
  nothing leaves the machine.
