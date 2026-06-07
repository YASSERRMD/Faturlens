// CSV export. RFC 4180 quoting, CRLF line endings, UTF-8 BOM for Excel.

import type { Field, InvoiceV1 } from '../../schema/invoice.ts';

const BOM = '﻿';
const CRLF = '\r\n';

/** Quote a single CSV field per RFC 4180 when it contains , " or newlines. */
export function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: string[][]): string {
  const body = rows.map((row) => row.map(csvField).join(',')).join(CRLF);
  return BOM + body + CRLF;
}

function s(field: Field<string> | undefined): string {
  return field?.value ?? '';
}
function n(field: Field<number> | undefined): string {
  return field?.value === null || field?.value === undefined ? '' : String(field.value);
}

const HEADER_COLUMNS = [
  'invoiceNumber',
  'issueDate',
  'dueDate',
  'vendorName',
  'vendorTRN',
  'buyerName',
  'currency',
  'subtotal',
  'taxAmount',
  'total',
  'paymentTerms',
  'needsReview',
];

/** One row per invoice — flattened scalar fields. */
export function headerCsv(
  invoices: InvoiceV1[],
  needsReviewFor: (invoice: InvoiceV1, index: number) => boolean = () => false,
): string {
  const rows: string[][] = [HEADER_COLUMNS];
  invoices.forEach((inv, i) => {
    rows.push([
      s(inv.invoiceNumber),
      s(inv.issueDate),
      s(inv.dueDate),
      s(inv.vendor.name),
      s(inv.vendor.trn),
      s(inv.buyer?.name),
      s(inv.currency),
      n(inv.subtotal),
      n(inv.taxAmount),
      n(inv.total),
      s(inv.paymentTerms),
      needsReviewFor(inv, i) ? 'true' : 'false',
    ]);
  });
  return toCsv(rows);
}

const LINE_COLUMNS = ['invoiceNumber', 'description', 'quantity', 'unitPrice', 'amount', 'taxRate'];

/** One row per line item, keyed by invoice number. */
export function linesCsv(invoices: InvoiceV1[]): string {
  const rows: string[][] = [LINE_COLUMNS];
  for (const inv of invoices) {
    const invoiceNumber = s(inv.invoiceNumber);
    for (const line of inv.lineItems) {
      rows.push([
        invoiceNumber,
        s(line.description),
        n(line.quantity),
        n(line.unitPrice),
        n(line.amount),
        n(line.taxRate),
      ]);
    }
  }
  return toCsv(rows);
}
