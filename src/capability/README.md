# capability

WebGPU detection, memory profiling, and the resulting `DeviceProfile`.

Pure detection — no ORT. Decides the execution provider (`webgpu` | `wasm`),
image token budget, max tiles per page, and surfaces human-readable warnings.
Exposed to the app via a `useDeviceProfile()` context hook.

_Populated in Phase 02._
