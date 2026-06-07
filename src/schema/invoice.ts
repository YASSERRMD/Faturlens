// InvoiceV1 — the validated, confidence-annotated invoice schema. Every leaf is
// wrapped as a Field<T> so the UI and validation layer can track, per value,
// whether it was directly extracted, inferred, or missing.

import { z } from 'zod';

export const confidenceSchema = z.enum(['extracted', 'inferred', 'missing']);
export type Confidence = z.infer<typeof confidenceSchema>;

export interface Field<T> {
  value: T | null;
  confidence: Confidence;
}

function field<T extends z.ZodTypeAny>(
  inner: T,
): z.ZodObject<{
  value: z.ZodNullable<T>;
  confidence: typeof confidenceSchema;
}> {
  return z.object({ value: inner.nullable(), confidence: confidenceSchema });
}

const stringField = field(z.string());
const numberField = field(z.number());

export const partySchema = z.object({
  name: stringField,
  address: stringField,
  trn: stringField,
  phone: stringField,
  email: stringField,
});

export const lineItemSchema = z.object({
  description: stringField,
  quantity: numberField,
  unitPrice: numberField,
  amount: numberField,
  taxRate: numberField.optional(),
});

export const invoiceV1Schema = z.object({
  vendor: partySchema,
  buyer: partySchema.optional(),
  invoiceNumber: stringField,
  issueDate: stringField,
  dueDate: stringField.optional(),
  currency: stringField,
  lineItems: z.array(lineItemSchema),
  subtotal: numberField,
  taxAmount: numberField,
  total: numberField,
  paymentTerms: stringField.optional(),
  notes: stringField.optional(),
  /** Field paths the model flagged as uncertain (e.g. "subtotal"). */
  uncertain: z.array(z.string()),
});

export type InvoiceV1 = z.infer<typeof invoiceV1Schema>;
export type Party = z.infer<typeof partySchema>;
export type LineItem = z.infer<typeof lineItemSchema>;
