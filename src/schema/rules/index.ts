// Validation layer public surface: the rule registry plus a convenience runner.

import type { InvoiceV1 } from '../invoice.ts';
import { arithmeticRules } from './arithmetic.ts';
import { runRules, type Rule, type RuleContext, type ValidationResult } from './engine.ts';
import { regionalRules } from './regional.ts';
import { foldReviewState, type ReviewState } from './review-state.ts';
import { sanityRules } from './sanity.ts';

export * from './engine.ts';
export * from './review-state.ts';
export { arithmeticRules } from './arithmetic.ts';
export { regionalRules } from './regional.ts';
export { sanityRules } from './sanity.ts';

/** All rules, grouped so a settings screen can toggle locales later. */
export const ALL_RULES: readonly Rule[] = [...arithmeticRules, ...regionalRules, ...sanityRules];

export interface Validation extends ValidationResult {
  review: ReviewState;
}

/** Run the full rule set and fold the result into a review state. */
export function validateInvoice(
  invoice: InvoiceV1,
  ctx: RuleContext = { today: new Date() },
): Validation {
  const result = runRules(invoice, ALL_RULES, ctx);
  return { ...result, review: foldReviewState(result) };
}
