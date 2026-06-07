# pipeline

Document ingestion and the two-pass extraction pipeline.

- **ingest/** — input acceptance, PDF rasterization, EXIF orientation, tiling,
  and in-worker tensor normalization.
- **pass1/** — full markdown transcription with deterministic quality signals.
- **pass2/** — schema-constrained JSON extraction with a repair ladder.

_Populated in Phases 05–07._
