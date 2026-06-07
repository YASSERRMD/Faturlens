# pipeline/pass2

Pass 2 — schema-constrained JSON extraction.

- `prompt.ts` — `PASS2_PROMPT_V1` (image(s) + Pass 1 transcript → JSON only) and
  `correctivePrompt()` for the single re-prompt.
- `repair.ts` — deterministic JSON repair ladder: strip fences → extract the
  outermost balanced `{}` → normalize syntax (trailing commas, single quotes,
  unquoted keys) → parse, with double-encoded-string handling. Pure, per-step.
- `run.ts` — `runPass2()`: infer → repair → validate against the raw contract →
  `mapRawToInvoice`. On a parse/validation failure, exactly **one** corrective
  re-prompt that echoes the errors, then a typed terminal failure.

See `src/schema/` for the `InvoiceV1` schema, the raw model JSON contract, and
the field-confidence semantics.
