# pipeline/pass1

Pass 1 — full-document transcription to Markdown.

- `prompt.ts` — `PASS1_PROMPT_V1` plus its version tag.
- `run.ts` — `runPass1()`: assembles tiles + thumbnail, streams Markdown, assesses
  quality, and retries **once** (thumbnail-only) when the first read fails.
- `quality.ts` — deterministic, ML-free signals (char/line counts, table-line
  ratio, digit density, `[unclear]` count, 20-word repetition score) folded into
  an `ok | suspect | failed` verdict with reasons.

## Prompt versioning convention

Prompt templates are **versioned artifacts**. Any wording change requires:

1. a new constant + version tag (e.g. `PASS1_PROMPT_V2`), and
2. a note in the export provenance envelope.

The active version travels with every `Pass1Result` as `promptVersion`, so any
exported document records exactly which prompt produced its transcript.
