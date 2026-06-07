import { describe, expect, it } from 'vitest';
import { csvField, headerCsv, linesCsv, toCsv } from './csv.ts';
import { f, makeInvoice, line } from './export-fixtures.ts';

describe('csvField', () => {
  it('leaves plain values unquoted', () => {
    expect(csvField('Acme')).toBe('Acme');
  });
  it('quotes and escapes commas, quotes, and newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
  });
  it('passes Arabic text through unquoted', () => {
    expect(csvField('شركة')).toBe('شركة');
  });
});

describe('toCsv', () => {
  it('prepends a UTF-8 BOM and uses CRLF', () => {
    const out = toCsv([['a', 'b']]);
    expect(out.startsWith('﻿')).toBe(true);
    expect(out).toContain('a,b\r\n');
  });
});

describe('headerCsv', () => {
  it('emits one row per invoice with a needsReview flag', () => {
    const out = headerCsv([makeInvoice()], () => true);
    const lines = out.trimEnd().split('\r\n');
    expect(lines[0]).toContain('invoiceNumber');
    expect(lines[1]).toContain('INV-001');
    expect(lines[1]).toContain('true');
  });

  it('keeps Arabic vendor names intact', () => {
    const inv = makeInvoice({ vendor: { ...makeInvoice().vendor, name: f('شركة الإمارات') } });
    expect(headerCsv([inv])).toContain('شركة الإمارات');
  });
});

describe('linesCsv', () => {
  it('emits one row per line item keyed by invoice number', () => {
    const inv = makeInvoice({ lineItems: [line(), line({ description: f('Gadget') })] });
    const rows = linesCsv([inv]).trimEnd().split('\r\n');
    expect(rows).toHaveLength(3); // header + 2 lines
    expect(rows[1]).toContain('INV-001');
    expect(rows[2]).toContain('Gadget');
  });
});
