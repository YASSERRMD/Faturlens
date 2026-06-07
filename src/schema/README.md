# schema

Zod schemas, the raw model JSON contract, and (Phase 08) the validation layer.

## Modules

- `invoice.ts` — `InvoiceV1`, the validated invoice schema. Every leaf is a
  `Field<T> = { value: T | null; confidence }`.
- `json-types.ts` — `rawInvoiceSchema` (the flat, lenient JSON the model emits)
  plus `mapRawToInvoice()` and `parseNumber()`.
- `rules/` — deterministic validation (Phase 08).

## Field confidence semantics

| confidence  | meaning                                                |
| ----------- | ------------------------------------------------------ |
| `extracted` | read directly from the document                        |
| `inferred`  | present but the model flagged the path in `_uncertain` |
| `missing`   | absent — `value` is `null`                             |

`parseNumber` tolerates formatted strings ("AED 1,234.50" → `1234.5`) and
returns `null` for anything non-numeric, so a garbled figure surfaces as a
missing value rather than a wrong one. The `uncertain` path list rides along on
the invoice for the validation layer (rule R024) and the export envelope.
