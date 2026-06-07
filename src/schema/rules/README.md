# schema/rules

The deterministic validation layer — pure TypeScript, zero ML. This is the trust
boundary: it gates every extraction and **never auto-corrects** a value
(suggestions are display-only).

## Engine

`runRules(invoice, rules, ctx)` aggregates `Finding[]` and computes per-field
`ok | warning | error` status (error beats warning on the same path).
`validateInvoice()` runs `ALL_RULES` and folds the result into a `ReviewState`
(`clean | needs-review | rejected`). Money comparisons use integer minor units
with a one-minor-unit tolerance — never floating-point equality.

## Rule catalog

| ID   | Severity        | Field                | Checks                                              |
| ---- | --------------- | -------------------- | --------------------------------------------------- |
| R001 | error           | `lineItems.N.amount` | quantity × unit price ≈ amount                      |
| R002 | error           | `subtotal`           | Σ line amounts ≈ subtotal                           |
| R003 | error           | `total`              | subtotal + tax ≈ total                              |
| R004 | warning         | `taxAmount`          | tax ≈ subtotal × dominant line rate                 |
| R010 | error / warning | `vendor.trn`         | UAE TRN is 15 digits (malformed→error, absent→warn) |
| R011 | warning         | `taxAmount`          | AED invoices expect 5% VAT                          |
| R012 | warning / error | `currency`           | preferred set ok; other ISO→warn; invalid→error     |
| R020 | error           | `dueDate`            | issueDate ≤ dueDate                                 |
| R021 | error           | `issueDate`          | within [2000-01-01, today + 1 year]                 |
| R022 | error           | `lineItems.N.*`      | non-negative quantity / price / amount              |
| R023 | error           | `lineItems`          | no items but a non-zero total (structural)          |
| R024 | warning         | (the path)           | model-flagged `_uncertain` paths                    |

Regional rules (R010–R012) are grouped separately so a future settings screen
can toggle locales. A document is **rejected** only on a structural failure
(R023); other errors yield **needs-review**.
