import { describe, expect, it } from 'vitest';
import { baseFilename, slugify, uniqueFilename } from './filename.ts';

describe('slugify', () => {
  it('slugifies ASCII names', () => {
    expect(slugify('Acme FZE Trading')).toBe('acme-fze-trading');
  });
  it('returns empty for Arabic-only input (caller falls back)', () => {
    expect(slugify('شركة')).toBe('');
  });
});

describe('baseFilename', () => {
  it('builds vendor_invoice_date', () => {
    expect(
      baseFilename({ vendorName: 'Acme FZE', invoiceNumber: 'INV-001', issueDate: '2026-01-15' }),
    ).toBe('acme-fze_inv-001_2026-01-15');
  });
  it('falls back to "vendor" for Arabic vendor names', () => {
    expect(
      baseFilename({
        vendorName: 'شركة الإمارات',
        invoiceNumber: 'INV-1',
        issueDate: '2026-01-15',
      }),
    ).toBe('vendor_inv-1_2026-01-15');
  });
  it('uses "undated" when the date is missing', () => {
    expect(baseFilename({ vendorName: 'Acme', invoiceNumber: '1', issueDate: null })).toBe(
      'acme_1_undated',
    );
  });
});

describe('uniqueFilename', () => {
  it('suffixes -2, -3 on collision', () => {
    const taken = new Set<string>();
    const parts = { vendorName: 'Acme', invoiceNumber: 'INV-1', issueDate: '2026-01-15' };
    expect(uniqueFilename(parts, 'json', taken)).toBe('acme_inv-1_2026-01-15.json');
    expect(uniqueFilename(parts, 'json', taken)).toBe('acme_inv-1_2026-01-15-2.json');
    expect(uniqueFilename(parts, 'json', taken)).toBe('acme_inv-1_2026-01-15-3.json');
  });
});
