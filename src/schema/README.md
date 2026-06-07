# schema

Zod schemas and the deterministic validation layer.

- `invoice.ts` — the `InvoiceV1` schema with per-field confidence wrappers.
- `json-types.ts` — the raw model JSON contract plus the mapper to `InvoiceV1`.
- `rules/` — pure-TypeScript, zero-ML validation rules. This layer is the trust
  boundary: it gates every extraction result and never silently fixes values.

_Populated in Phases 07–08._
