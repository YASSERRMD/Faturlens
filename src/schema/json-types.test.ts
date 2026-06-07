import { describe, expect, it } from 'vitest';
import { invoiceV1Schema } from './invoice.ts';
import { mapRawToInvoice, parseNumber, rawInvoiceSchema, type RawInvoice } from './json-types.ts';

const complete: RawInvoice = {
  vendor: { name: 'Acme FZE', address: 'Dubai', trn: '100123456700003', phone: null, email: null },
  buyer: { name: 'Buyer LLC', address: null, trn: null, phone: null, email: null },
  invoiceNumber: 'INV-001',
  issueDate: '2026-01-15',
  dueDate: '2026-02-15',
  currency: 'AED',
  lineItems: [{ description: 'Widget', quantity: 2, unitPrice: '50.00', amount: 100, taxRate: 5 }],
  subtotal: 100,
  taxAmount: 5,
  total: 105,
  paymentTerms: 'Net 30',
  notes: null,
  _uncertain: ['subtotal'],
};

describe('parseNumber', () => {
  it('passes through finite numbers', () => {
    expect(parseNumber(42)).toBe(42);
  });
  it('strips currency and separators from strings', () => {
    expect(parseNumber('AED 1,234.50')).toBe(1234.5);
  });
  it('returns null for null/undefined/garbage', () => {
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});

describe('mapRawToInvoice', () => {
  it('maps a complete invoice and round-trips through the schema', () => {
    const invoice = mapRawToInvoice(complete);
    expect(invoiceV1Schema.safeParse(invoice).success).toBe(true);
    expect(invoice.vendor.name).toEqual({ value: 'Acme FZE', confidence: 'extracted' });
    expect(invoice.subtotal.value).toBe(100);
    expect(invoice.lineItems[0]?.unitPrice.value).toBe(50);
  });

  it('marks uncertain paths as inferred', () => {
    const invoice = mapRawToInvoice(complete);
    expect(invoice.subtotal.confidence).toBe('inferred');
    expect(invoice.uncertain).toContain('subtotal');
  });

  it('handles a sparse invoice with mostly nulls', () => {
    const sparse: RawInvoice = {
      vendor: null,
      buyer: null,
      invoiceNumber: null,
      issueDate: null,
      dueDate: null,
      currency: null,
      lineItems: null,
      subtotal: null,
      taxAmount: null,
      total: null,
      paymentTerms: null,
      notes: null,
      _uncertain: null,
    };
    const invoice = mapRawToInvoice(sparse);
    expect(invoiceV1Schema.safeParse(invoice).success).toBe(true);
    expect(invoice.vendor.name).toEqual({ value: null, confidence: 'missing' });
    expect(invoice.lineItems).toHaveLength(0);
    expect(invoice.buyer).toBeUndefined();
    expect(invoice.dueDate).toBeUndefined();
  });

  it('omits optional taxRate when absent', () => {
    const raw = rawInvoiceSchema.parse({
      vendor: { name: 'V' },
      invoiceNumber: '1',
      issueDate: '2026-01-01',
      currency: 'AED',
      lineItems: [{ description: 'X', quantity: 1, unitPrice: 1, amount: 1 }],
      subtotal: 1,
      taxAmount: 0,
      total: 1,
    });
    const invoice = mapRawToInvoice(raw);
    expect(invoice.lineItems[0]?.taxRate).toBeUndefined();
  });
});
