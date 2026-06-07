// Sanity rules: date ordering/plausibility, non-negative values, structural
// checks, and uncertain-path surfacing.

import { num, str, type Rule } from './engine.ts';

const MIN_DATE = new Date('2000-01-01T00:00:00Z').getTime();

function parseIsoDate(value: string | null): number | null {
  if (value === null) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

export const dateOrderRule: Rule = {
  id: 'R020',
  severity: 'error',
  check: (invoice) => {
    const issue = parseIsoDate(str(invoice.issueDate));
    const due = parseIsoDate(invoice.dueDate?.value ?? null);
    if (issue === null || due === null) return [];
    if (due >= issue) return [];
    return [
      {
        ruleId: 'R020',
        severity: 'error',
        fieldPath: 'dueDate',
        message: 'Due date is before the issue date',
      },
    ];
  },
};

export const datePlausibilityRule: Rule = {
  id: 'R021',
  severity: 'error',
  check: (invoice, ctx) => {
    const issue = parseIsoDate(str(invoice.issueDate));
    if (issue === null) return [];
    const upper = new Date(ctx.today);
    upper.setFullYear(upper.getFullYear() + 1);
    if (issue >= MIN_DATE && issue <= upper.getTime()) return [];
    return [
      {
        ruleId: 'R021',
        severity: 'error',
        fieldPath: 'issueDate',
        message: 'Issue date is implausible (before 2000 or more than a year in the future)',
      },
    ];
  },
};

export const nonNegativeRule: Rule = {
  id: 'R022',
  severity: 'error',
  check: (invoice) => {
    return invoice.lineItems.flatMap((line, i) => {
      const checks: { key: 'quantity' | 'unitPrice' | 'amount'; value: number | null }[] = [
        { key: 'quantity', value: num(line.quantity) },
        { key: 'unitPrice', value: num(line.unitPrice) },
        { key: 'amount', value: num(line.amount) },
      ];
      return checks
        .filter((c) => c.value !== null && c.value < 0)
        .map((c) => ({
          ruleId: 'R022',
          severity: 'error' as const,
          fieldPath: `lineItems.${String(i)}.${c.key}`,
          message: `Line ${String(i + 1)} ${c.key} is negative`,
        }));
    });
  },
};

export const emptyLineItemsRule: Rule = {
  id: 'R023',
  severity: 'error',
  check: (invoice) => {
    const total = num(invoice.total);
    if (invoice.lineItems.length > 0 || total === null || total === 0) return [];
    return [
      {
        ruleId: 'R023',
        severity: 'error',
        fieldPath: 'lineItems',
        message: `No line items, but total is ${total.toFixed(2)}`,
      },
    ];
  },
};

export const uncertainPathRule: Rule = {
  id: 'R024',
  severity: 'warning',
  check: (invoice) => {
    return invoice.uncertain.map((path) => ({
      ruleId: 'R024',
      severity: 'warning' as const,
      fieldPath: path,
      message: 'The model flagged this value as uncertain',
    }));
  },
};

export const sanityRules: readonly Rule[] = [
  dateOrderRule,
  datePlausibilityRule,
  nonNegativeRule,
  emptyLineItemsRule,
  uncertainPathRule,
];
