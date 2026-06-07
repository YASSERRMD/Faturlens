# Faturlens

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

Browser-native invoice OCR and structured extraction. A transformer
vision-language model (`LiquidAI/LFM2.5-VL-1.6B-ONNX`) runs **fully client-side**
via WebGPU, with a WASM CPU fallback. No server, no API, no data leaves the
machine — the app is offline-first after the one-time model download.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Main thread (UI)                          │
│  capability ─► model gate ─► ingest ─► review ─► export            │
└───────────────┬───────────────────────────────────┬──────────────┘
                │ ImageBitmaps / prompts             │ tokens / stats
                ▼                                     ▲
┌──────────────────────────────────────────────────────────────────┐
│                     Inference Web Worker                           │
│  Cache API bytes ─► ORT sessions (WebGPU | WASM)                   │
│  Pass 1: full markdown transcription                              │
│  Pass 2: schema-constrained JSON extraction                       │
└──────────────────────────────────────────────────────────────────┘
                │ extraction
                ▼
   Deterministic validation layer (pure TS, zero ML) ─► human review
```

> Diagram is a placeholder; a committed SVG lands in Phase 13.

## Hardware targets

| Path     | Hardware                                            | Notes                         |
| -------- | --------------------------------------------------- | ----------------------------- |
| Primary  | 16GB RAM laptops, integrated GPU (Iris Xe / Radeon) | WebGPU execution provider     |
| Fallback | CPU-only browsers                                   | WASM EP, reduced token budget |

The browser tab memory ceiling is treated as a hard 4GB budget; the app aborts
gracefully beyond it.

## Privacy

Zero network calls after the model download, except explicit Hugging Face CDN
fetches during caching. No telemetry, no analytics, no external fonts, no
runtime CDN scripts.

## Development

```bash
npm ci          # install
npm run dev      # start the dev server
npm run typecheck
npm run lint
npm run test
npm run build
```

Requires Node 22 (see `.nvmrc`).

## License

[Apache-2.0](./LICENSE)
