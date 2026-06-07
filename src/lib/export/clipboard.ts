// Clipboard helpers: copy a single invoice as JSON or as a TSV table that
// pastes cleanly into Excel.

import type { InvoiceV1 } from '../../schema/invoice.ts';
import { exportInvoiceJson, type ExportInput } from './json.ts';

/** Render an invoice's line items as a TSV table (header + rows). */
export function invoiceToTsv(invoice: InvoiceV1): string {
  const header = ['description', 'quantity', 'unitPrice', 'amount', 'taxRate'];
  const cell = (v: string | number | null): string =>
    v === null ? '' : String(v).replace(/[\t\n\r]/g, ' ');
  const rows = invoice.lineItems.map((line) =>
    [
      cell(line.description.value),
      cell(line.quantity.value),
      cell(line.unitPrice.value),
      cell(line.amount.value),
      cell(line.taxRate?.value ?? null),
    ].join('\t'),
  );
  return [header.join('\t'), ...rows].join('\n');
}

async function write(text: string): Promise<boolean> {
  const clipboard = (globalThis.navigator as Navigator | undefined)?.clipboard;
  if (!clipboard) return false;
  await clipboard.writeText(text);
  return true;
}

export function copyInvoiceJson(input: ExportInput): Promise<boolean> {
  return write(exportInvoiceJson(input));
}

export function copyInvoiceTsv(invoice: InvoiceV1): Promise<boolean> {
  return write(invoiceToTsv(invoice));
}
