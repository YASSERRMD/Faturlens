import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildZip, combinedJson, selectForExport } from './batch.ts';
import { makeInput } from './export-fixtures.ts';

describe('selectForExport', () => {
  it('excludes unapproved documents by default', () => {
    const inputs = [makeInput({ approved: true }), makeInput({ approved: false })];
    expect(selectForExport(inputs, false)).toHaveLength(1);
  });
  it('includes unapproved when the toggle is on', () => {
    const inputs = [makeInput({ approved: true }), makeInput({ approved: false })];
    expect(selectForExport(inputs, true)).toHaveLength(2);
  });
});

describe('combinedJson', () => {
  it('emits an array of envelopes', () => {
    const json = JSON.parse(combinedJson([makeInput(), makeInput()])) as unknown[];
    expect(json).toHaveLength(2);
  });
});

describe('buildZip', () => {
  it('bundles per-invoice JSON plus both CSVs', () => {
    const zip = buildZip([makeInput()], { includeUnapproved: false });
    const entries = unzipSync(zip);
    const names = Object.keys(entries);
    expect(names).toContain('header.csv');
    expect(names).toContain('lines.csv');
    expect(names.some((n) => n.endsWith('.json'))).toBe(true);
  });

  it('respects approval gating in the bundle', () => {
    const inputs = [makeInput({ approved: true }), makeInput({ approved: false })];
    const zip = buildZip(inputs, { includeUnapproved: false });
    const jsonEntries = Object.keys(unzipSync(zip)).filter((n) => n.endsWith('.json'));
    expect(jsonEntries).toHaveLength(1);
  });

  it('marks unapproved rows when included', () => {
    const zip = buildZip([makeInput({ approved: false })], { includeUnapproved: true });
    const header = strFromU8(unzipSync(zip)['header.csv'] ?? new Uint8Array());
    expect(header).toContain('true');
  });
});
