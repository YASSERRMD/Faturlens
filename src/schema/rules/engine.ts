// Rule engine: runs every rule, aggregates findings, and computes per-field
// status. Pure TypeScript, zero ML — this is the trust boundary of Faturlens.

import type { Field, InvoiceV1 } from '../invoice.ts';

export type Severity = 'error' | 'warning';
export type FieldStatus = 'ok' | 'warning' | 'error';

export interface Finding {
  ruleId: string;
  severity: Severity;
  fieldPath: string;
  message: string;
  /** Display-only hint. Never auto-applied. */
  suggestion?: string;
}

export interface RuleContext {
  /** Reference "now" for date plausibility, injectable for tests. */
  today: Date;
}

export interface Rule {
  id: string;
  severity: Severity;
  check: (invoice: InvoiceV1, ctx: RuleContext) => Finding[];
}

export interface ValidationResult {
  findings: Finding[];
  /** Status by field path. Paths absent from the map are implicitly "ok". */
  fieldStatus: Record<string, FieldStatus>;
}

/** Read a numeric field's value, or null. */
export function num(field: Field<number> | undefined): number | null {
  return field?.value ?? null;
}

/** Read a string field's value, or null. */
export function str(field: Field<string> | undefined): string | null {
  return field?.value ?? null;
}

export function statusFor(result: ValidationResult, fieldPath: string): FieldStatus {
  return result.fieldStatus[fieldPath] ?? 'ok';
}

/** Run all rules and aggregate findings into per-field statuses. */
export function runRules(
  invoice: InvoiceV1,
  rules: readonly Rule[],
  ctx: RuleContext,
): ValidationResult {
  const findings: Finding[] = [];
  for (const rule of rules) {
    findings.push(...rule.check(invoice, ctx));
  }

  const fieldStatus: Record<string, FieldStatus> = {};
  for (const finding of findings) {
    const current = fieldStatus[finding.fieldPath];
    if (finding.severity === 'error') {
      fieldStatus[finding.fieldPath] = 'error';
    } else if (current !== 'error') {
      fieldStatus[finding.fieldPath] = 'warning';
    }
  }

  return { findings, fieldStatus };
}
