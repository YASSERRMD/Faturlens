import { describe, expect, it } from 'vitest';
import { extractBalancedObject, normalizeSyntax, repairJson, stripFences } from './repair.ts';

describe('stripFences', () => {
  it('removes json code fences', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
});

describe('extractBalancedObject', () => {
  it('extracts the outermost object ignoring braces in strings', () => {
    expect(extractBalancedObject('noise {"a":"}{"} tail')).toBe('{"a":"}{"}');
  });
  it('returns null for truncated input', () => {
    expect(extractBalancedObject('{"a": 1, "b":')).toBeNull();
  });
});

describe('normalizeSyntax', () => {
  it('removes trailing commas', () => {
    expect(normalizeSyntax('{"a":1,}')).toBe('{"a":1}');
  });
  it('quotes unquoted keys', () => {
    expect(normalizeSyntax('{a:1}')).toContain('"a":1');
  });
  it('converts single quotes', () => {
    expect(normalizeSyntax("{'a':'b'}")).toContain('"a":"b"');
  });
});

describe('repairJson — malformed fixtures', () => {
  const valid = { invoiceNumber: 'INV-1', total: 100 };

  it('parses clean JSON', () => {
    expect(repairJson('{"invoiceNumber":"INV-1","total":100}')).toEqual({ ok: true, value: valid });
  });

  it('parses fenced JSON', () => {
    expect(repairJson('```json\n{"invoiceNumber":"INV-1","total":100}\n```').ok).toBe(true);
  });

  it('parses prose-wrapped JSON', () => {
    const r = repairJson('Here is the result:\n{"invoiceNumber":"INV-1","total":100}\nThanks!');
    expect(r.ok).toBe(true);
  });

  it('repairs trailing commas', () => {
    expect(repairJson('{"invoiceNumber":"INV-1","total":100,}').ok).toBe(true);
  });

  it('repairs single quotes', () => {
    expect(repairJson("{'invoiceNumber':'INV-1','total':100}").ok).toBe(true);
  });

  it('repairs unquoted keys', () => {
    expect(repairJson('{invoiceNumber:"INV-1",total:100}').ok).toBe(true);
  });

  it('handles double-encoded JSON strings', () => {
    const doubled = JSON.stringify(JSON.stringify(valid));
    const r = repairJson(doubled);
    expect(r).toEqual({ ok: true, value: valid });
  });

  it('fails with extract-braces stage when no object present', () => {
    const r = repairJson('totally not json');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.stage).toBe('extract-braces');
      expect(typeof r.message).toBe('string');
    }
  });

  it('fails with extract-braces stage on truncated output', () => {
    const r = repairJson('{"invoiceNumber":"INV-1", "total":');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.stage).toBe('extract-braces');
  });

  it('fails with parse stage on irreparable syntax', () => {
    const r = repairJson('{"a": @@@ }');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.stage).toBe('parse');
  });

  it('repairs combined trailing comma + unquoted key', () => {
    expect(repairJson('{invoiceNumber:"INV-1", total:100,}').ok).toBe(true);
  });
});
