// Batch export: a combined JSON array, or a zip bundle of per-invoice JSON plus
// header and line CSVs. Export is gated on approval.

import { strToU8, zipSync } from 'fflate';
import { headerCsv, linesCsv } from './csv.ts';
import { uniqueFilename } from './filename.ts';
import { buildEnvelope, canonicalStringify, exportInvoiceJson, type ExportInput } from './json.ts';

/**
 * Select which documents to export. Unapproved documents are excluded unless
 * `includeUnapproved` is set; the envelope already carries `needsReview`.
 */
export function selectForExport(inputs: ExportInput[], includeUnapproved: boolean): ExportInput[] {
  return includeUnapproved ? inputs : inputs.filter((i) => i.approved);
}

/** Combined JSON array of envelopes (canonical, stable order). */
export function combinedJson(inputs: ExportInput[]): string {
  return canonicalStringify(inputs.map(buildEnvelope));
}

export interface ZipOptions {
  includeUnapproved: boolean;
}

/** Build a zip: one JSON per invoice + header.csv + lines.csv. */
export function buildZip(inputs: ExportInput[], options: ZipOptions): Uint8Array {
  const selected = selectForExport(inputs, options.includeUnapproved);
  const taken = new Set<string>();
  const files: Record<string, Uint8Array> = {};

  for (const input of selected) {
    const name = uniqueFilename(
      {
        vendorName: input.invoice.vendor.name.value,
        invoiceNumber: input.invoice.invoiceNumber.value,
        issueDate: input.invoice.issueDate.value,
      },
      'json',
      taken,
    );
    files[name] = strToU8(exportInvoiceJson(input));
  }

  const invoices = selected.map((i) => i.invoice);
  const needsReview = new Map(selected.map((i) => [i.invoice, !i.approved]));
  files['header.csv'] = strToU8(headerCsv(invoices, (inv) => needsReview.get(inv) ?? false));
  files['lines.csv'] = strToU8(linesCsv(invoices));

  return zipSync(files);
}
