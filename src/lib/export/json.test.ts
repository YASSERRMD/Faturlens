import { describe, expect, it } from 'vitest';
import { invoiceV1Schema } from '../../schema/invoice.ts';
import { makeInput } from './export-fixtures.ts';
import { buildEnvelope, canonicalStringify, exportInvoiceJson } from './json.ts';

describe('canonicalStringify', () => {
  it('orders object keys deterministically regardless of input order', () => {
    const a = canonicalStringify({ b: 1, a: 2, c: { z: 1, y: 2 } });
    const b = canonicalStringify({ c: { y: 2, z: 1 }, a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('preserves array order', () => {
    expect(canonicalStringify([3, 1, 2])).toBe('[\n  3,\n  1,\n  2\n]');
  });
});

describe('exportInvoiceJson', () => {
  it('produces a stable string for the same input', () => {
    const input = makeInput();
    expect(exportInvoiceJson(input)).toBe(exportInvoiceJson(input));
  });

  it('round-trips the invoice back through the schema', () => {
    const envelope = buildEnvelope(makeInput());
    const parsed = JSON.parse(exportInvoiceJson(makeInput())) as { invoice: unknown };
    expect(invoiceV1Schema.safeParse(parsed.invoice).success).toBe(true);
    expect(envelope.faturlens.model).toBe('LFM2.5-VL-1.6B-ONNX');
  });

  it('marks unapproved exports as needing review', () => {
    const envelope = buildEnvelope(makeInput({ approved: false }));
    expect(envelope.faturlens.needsReview).toBe(true);
  });
});
