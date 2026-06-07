// Canonical JSON export with a provenance envelope and a deterministic,
// key-ordered serializer so diffs of exports are meaningful.

import type { InvoiceV1 } from '../../schema/invoice.ts';
import type { Finding, ReviewVerdict } from '../../schema/rules/index.ts';
import type { EditEntry } from '../../ui/review/state.ts';

export const FATURLENS_EXPORT_VERSION = '1.0';
export const MODEL_ID = 'LFM2.5-VL-1.6B-ONNX';

export interface ExportInput {
  invoice: InvoiceV1;
  verdict: ReviewVerdict;
  findings: Finding[];
  promptVersions: { pass1: string; pass2: string };
  edits: EditEntry[];
  approved: boolean;
  /** ISO timestamp; supplied by the caller to keep exports deterministic. */
  exportedAt: string;
}

export interface ExportEnvelope {
  faturlens: {
    version: string;
    exportedAt: string;
    model: string;
    promptVersions: { pass1: string; pass2: string };
    validation: { verdict: ReviewVerdict; findings: Finding[] };
    edits: EditEntry[];
    approved: boolean;
    needsReview: boolean;
  };
  invoice: InvoiceV1;
}

export function buildEnvelope(input: ExportInput): ExportEnvelope {
  return {
    faturlens: {
      version: FATURLENS_EXPORT_VERSION,
      exportedAt: input.exportedAt,
      model: MODEL_ID,
      promptVersions: input.promptVersions,
      validation: { verdict: input.verdict, findings: input.findings },
      edits: input.edits,
      approved: input.approved,
      needsReview: !input.approved,
    },
    invoice: input.invoice,
  };
}

/** Deterministic JSON: object keys sorted recursively, arrays preserved. */
export function canonicalStringify(value: unknown, indent = 2): string {
  return JSON.stringify(sortKeys(value), null, indent);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

/** Serialize one invoice export to a canonical JSON string. */
export function exportInvoiceJson(input: ExportInput): string {
  return canonicalStringify(buildEnvelope(input));
}
