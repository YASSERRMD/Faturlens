# worker

Dedicated inference Web Worker and ORT sessions.

**Invariant:** all `onnxruntime-web` sessions live here. The main thread never
touches ORT. The worker hosts the model loader/cache, session creation, and the
autoregressive generation loop, exposing a typed message protocol to the main
thread.

_Populated in Phase 03 (loader) and Phase 04 (inference worker)._
