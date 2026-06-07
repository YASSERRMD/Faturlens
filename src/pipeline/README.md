# pipeline

Document ingestion and the two-pass extraction pipeline.

## ingest/ (Phase 05)

- `accept.ts` — input acceptance (PNG/JPEG/WebP/PDF, ≤25MB, ≤20 PDF pages) with
  typed rejection reasons. Pure.
- `dpi.ts` — `sizingForPage()` picks a render scale so a PDF page's longest edge
  lands near 1536px (3 tiles), capped at 2048px. Pure.
- `pdf.ts` — lazy pdf.js rasterization; a page renders only when requested.
- `orientation.ts` — EXIF-aware decode via `createImageBitmap(..., 'from-image')`.
- `preprocess.ts` — `planTiles()` (pure geometry) + `extractTiles()` (bitmaps).
  Tiling contract: images ≤512² pass through at native resolution (never
  upscaled); larger images become a non-overlapping 512² grid plus one
  downscaled thumbnail; the grid is clamped to the device `maxTilesPerPage` by
  downscaling the page first.
- `normalize.ts` — `pixelsToCHW()` RGBA→normalized channel-first float array
  (mean/std from processor config). Runs in the worker.
- `ingest.ts` — orchestrator: accept → decode → lazy per-page bitmaps → tiling.

The pure pieces (acceptance, DPI, tile geometry, normalization) are unit-tested;
canvas/pdf/bitmap glue is browser-only.

## pass1/, pass2/

Populated in Phases 06–07.
