// The raw, flat JSON contract the model is asked to emit (no Field wrappers),
// plus a mapper into the confidence-annotated InvoiceV1.

import { z } from 'zod';
import {
  type Confidence,
  type Field,
  type InvoiceV1,
  type LineItem,
  type Party,
} from './invoice.ts';

const rawString = z.string().nullable().optional();
// Numbers may arrive as numbers or numeric strings ("1,234.50").
const rawNumber = z.union([z.number(), z.string()]).nullable().optional();

const rawPartySchema = z
  .object({
    name: rawString,
    address: rawString,
    trn: rawString,
    phone: rawString,
    email: rawString,
  })
  .nullable()
  .optional();

const rawLineItemSchema = z.object({
  description: rawString,
  quantity: rawNumber,
  unitPrice: rawNumber,
  amount: rawNumber,
  taxRate: rawNumber,
});

export const rawInvoiceSchema = z.object({
  vendor: rawPartySchema,
  buyer: rawPartySchema,
  invoiceNumber: rawString,
  issueDate: rawString,
  dueDate: rawString,
  currency: rawString,
  lineItems: z.array(rawLineItemSchema).nullable().optional(),
  subtotal: rawNumber,
  taxAmount: rawNumber,
  total: rawNumber,
  paymentTerms: rawString,
  notes: rawString,
  _uncertain: z.array(z.string()).nullable().optional(),
});

export type RawInvoice = z.infer<typeof rawInvoiceSchema>;

/** Parse a numeric value that may be a number or a formatted string. */
export function parseNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/[^0-9.+-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '+') return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function confidenceFor(value: unknown, path: string, uncertain: Set<string>): Confidence {
  if (value === null || value === undefined) return 'missing';
  if (uncertain.has(path)) return 'inferred';
  return 'extracted';
}

function stringFieldFrom(
  value: string | null | undefined,
  path: string,
  uncertain: Set<string>,
): Field<string> {
  return { value: value ?? null, confidence: confidenceFor(value, path, uncertain) };
}

function numberFieldFrom(
  value: number | string | null | undefined,
  path: string,
  uncertain: Set<string>,
): Field<number> {
  const parsed = parseNumber(value);
  return { value: parsed, confidence: confidenceFor(parsed, path, uncertain) };
}

function partyFrom(
  raw: NonNullable<RawInvoice['vendor']> | null | undefined,
  prefix: string,
  uncertain: Set<string>,
): Party {
  const p = raw ?? {};
  return {
    name: stringFieldFrom(p.name, `${prefix}.name`, uncertain),
    address: stringFieldFrom(p.address, `${prefix}.address`, uncertain),
    trn: stringFieldFrom(p.trn, `${prefix}.trn`, uncertain),
    phone: stringFieldFrom(p.phone, `${prefix}.phone`, uncertain),
    email: stringFieldFrom(p.email, `${prefix}.email`, uncertain),
  };
}

/** Map a validated raw model JSON object into the confidence-annotated InvoiceV1. */
export function mapRawToInvoice(raw: RawInvoice): InvoiceV1 {
  const uncertain = new Set(raw._uncertain ?? []);

  const lineItems: LineItem[] = (raw.lineItems ?? []).map((item, i) => {
    const base = `lineItems.${String(i)}`;
    const line: LineItem = {
      description: stringFieldFrom(item.description, `${base}.description`, uncertain),
      quantity: numberFieldFrom(item.quantity, `${base}.quantity`, uncertain),
      unitPrice: numberFieldFrom(item.unitPrice, `${base}.unitPrice`, uncertain),
      amount: numberFieldFrom(item.amount, `${base}.amount`, uncertain),
    };
    if (item.taxRate !== null && item.taxRate !== undefined) {
      line.taxRate = numberFieldFrom(item.taxRate, `${base}.taxRate`, uncertain);
    }
    return line;
  });

  const invoice: InvoiceV1 = {
    vendor: partyFrom(raw.vendor, 'vendor', uncertain),
    invoiceNumber: stringFieldFrom(raw.invoiceNumber, 'invoiceNumber', uncertain),
    issueDate: stringFieldFrom(raw.issueDate, 'issueDate', uncertain),
    currency: stringFieldFrom(raw.currency, 'currency', uncertain),
    lineItems,
    subtotal: numberFieldFrom(raw.subtotal, 'subtotal', uncertain),
    taxAmount: numberFieldFrom(raw.taxAmount, 'taxAmount', uncertain),
    total: numberFieldFrom(raw.total, 'total', uncertain),
    uncertain: [...uncertain],
  };

  if (raw.buyer) invoice.buyer = partyFrom(raw.buyer, 'buyer', uncertain);
  if (raw.dueDate !== null && raw.dueDate !== undefined) {
    invoice.dueDate = stringFieldFrom(raw.dueDate, 'dueDate', uncertain);
  }
  if (raw.paymentTerms !== null && raw.paymentTerms !== undefined) {
    invoice.paymentTerms = stringFieldFrom(raw.paymentTerms, 'paymentTerms', uncertain);
  }
  if (raw.notes !== null && raw.notes !== undefined) {
    invoice.notes = stringFieldFrom(raw.notes, 'notes', uncertain);
  }

  return invoice;
}
