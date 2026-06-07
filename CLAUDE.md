# Faturlens — Project Rules

## Identity and Git Discipline
- Git identity: YASSERRMD / arafath.yasser@gmail.com (set in Phase 01, verify before every phase)
- One branch per phase: `phase-NN-short-name`. Branch from latest main.
- NEVER push directly to main. Every phase ends with a pushed branch and an open PR.
- Atomic commits only: each commit is one logical unit, 3 to 15 minutes of work, builds green.
- Conventional commit format: `type(scope): message` (feat, fix, chore, test, docs, refactor, perf).
- NO chained phase execution. Complete the phase, stop, wait for review.

## Stack (locked, do not substitute)
- Vite 6 + React 18 + TypeScript 5 (strict mode)
- onnxruntime-web (webgpu build) for inference, @huggingface/transformers for tokenizer only
- Model: LiquidAI/LFM2.5-VL-1.6B-ONNX — FP16 vision encoder + Q4 decoder + embeddings
- pdfjs-dist for PDF rasterization
- Dexie for IndexedDB
- Zod for schemas and validation
- Vitest + @testing-library/react for tests
- No state library; React context + reducers only
- No CSS framework; CSS modules with design tokens

## Hardware Target
- Primary: 16GB RAM laptops with integrated GPU (Intel Iris Xe / AMD Radeon iGPU) via WebGPU
- Fallback: WASM CPU path with reduced image token budget
- Browser tab memory ceiling: treat 4GB as the hard budget; abort gracefully beyond it

## Architecture Invariants
- ALL inference runs in a dedicated Web Worker. The main thread never touches ORT sessions.
- Two-pass pipeline: Pass 1 full markdown transcription, Pass 2 schema-constrained JSON extraction.
- Deterministic validation layer (pure TypeScript, zero ML) gates every extraction result.
- Failed validation marks fields for human review. Never silently accept or silently fix.
- Model weights cached via Cache API; the app is offline-first after first load.

## Privacy Invariants
- Zero network calls after model download except explicit HF CDN fetches during caching.
- No telemetry, no analytics, no external fonts, no CDN scripts at runtime.

## Quality Gates (every commit)
- `npm run typecheck` passes
- `npm run lint` passes
- `npm run test` passes
- No `any` types, no `@ts-ignore` without a linked issue comment
