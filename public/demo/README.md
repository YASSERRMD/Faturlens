# demo

Synthetic demo invoices loaded by the first-run welcome screen. All synthetic —
no real vendor data.

- `clean-en.html` — clean English invoice (arithmetic balances).
- `bilingual.html` — Arabic–English bilingual invoice.
- `multipage.html` — multi-page invoice.
- `broken-math.html` — deliberately broken arithmetic to showcase the validation
  layer (subtotal and total do not add up → red findings).
- `demo.json` — manifest consumed by the loader.

The `.html` files are the **sources**; they are rendered to PNG/PDF (the formats
the pipeline ingests) at build time. Keeping the HTML in-repo makes the demos
easy to tweak without binary churn.
