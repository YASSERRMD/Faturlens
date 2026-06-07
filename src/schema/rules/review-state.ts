// Fold validation findings into a review state. Never auto-corrects a value;
// suggestions are display-only.

import type { Finding, ValidationResult } from './engine.ts';

export type ReviewVerdict = 'clean' | 'needs-review' | 'rejected';

export interface ReviewState {
  verdict: ReviewVerdict;
  /** Field paths a human must look at: any error, or a warning on a money field. */
  fieldsNeedingReview: string[];
  errorCount: number;
  warningCount: number;
}

const MONEY_FIELD = /^(subtotal|taxAmount|total)$|^lineItems\.\d+\.(amount|unitPrice)$/;

// Findings severe enough to reject the document outright.
const STRUCTURAL_RULES = new Set(['R023']);

function isMoneyField(path: string): boolean {
  return MONEY_FIELD.test(path);
}

export function foldReviewState(result: ValidationResult): ReviewState {
  const errors = result.findings.filter((f) => f.severity === 'error');
  const warnings = result.findings.filter((f) => f.severity === 'warning');

  const needing = new Set<string>();
  for (const finding of errors) needing.add(finding.fieldPath);
  for (const finding of warnings) {
    if (isMoneyField(finding.fieldPath)) needing.add(finding.fieldPath);
  }

  let verdict: ReviewVerdict;
  if (errors.length === 0) {
    verdict = warnings.length === 0 ? 'clean' : 'needs-review';
  } else {
    const structural = errors.some((f: Finding) => STRUCTURAL_RULES.has(f.ruleId));
    verdict = structural ? 'rejected' : 'needs-review';
  }

  return {
    verdict,
    fieldsNeedingReview: [...needing],
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}
