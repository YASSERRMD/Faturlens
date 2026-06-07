# capability

WebGPU detection, memory profiling, and the resulting `DeviceProfile`.

Pure detection — no ORT. All detection functions accept injectable
navigator/performance objects so unit tests never touch the real environment.

## Modules

- `webgpu.ts` — `detectWebGpu()` probes `navigator.gpu`, requests an adapter,
  and reads its limits and info. Never throws; returns a typed result.
- `memory.ts` — `detectMemory()` reads `navigator.deviceMemory` and
  `performance.memory`, classifying a `MemoryTier`.
- `profile.ts` — `composeProfile()` (pure) and `resolveDeviceProfile()` (async)
  combine detection into the `DeviceProfile`.
- `useDeviceProfile.tsx` — resolves the profile once and caches it in context.

## Decision table

| WebGPU adapter | Memory tier   | Provider | Token budget / tile | Max tiles / page |
| -------------- | ------------- | -------- | ------------------- | ---------------- |
| available      | standard/high | webgpu   | 256                 | 6                |
| available      | low           | webgpu   | 128                 | 6                |
| none           | any           | wasm     | 128                 | 4                |

`concurrency` is always `1` — a single inference at a time is a hard rule.

The reduced (128) budget applies when the provider is WASM **or** the memory
tier is low. Warnings are surfaced for: no WebGPU adapter, fallback (software)
adapter, undetectable device memory, and low memory.
