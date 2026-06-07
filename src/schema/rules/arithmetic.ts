// Arithmetic rules. Integer minor units throughout; rounding tolerance of one
// minor unit per line.

import { num, type Rule } from './engine.ts';
import { approxEqualMinor, sumMinor } from './money.ts';

export const lineAmountRule: Rule = {
  id: 'R001',
  severity: 'error',
  check: (invoice) => {
    return invoice.lineItems.flatMap((line, i) => {
      const qty = num(line.quantity);
      const unit = num(line.unitPrice);
      const amount = num(line.amount);
      if (qty === null || unit === null || amount === null) return [];
      const expected = qty * unit;
      if (approxEqualMinor(expected, amount, 1)) return [];
      return [
        {
          ruleId: 'R001',
          severity: 'error' as const,
          fieldPath: `lineItems.${String(i)}.amount`,
          message: `Line ${String(i + 1)}: quantity × unit price = ${expected.toFixed(2)}, but amount is ${amount.toFixed(2)}`,
          suggestion: expected.toFixed(2),
        },
      ];
    });
  },
};

export const subtotalRule: Rule = {
  id: 'R002',
  severity: 'error',
  check: (invoice) => {
    const subtotal = num(invoice.subtotal);
    const amounts = invoice.lineItems
      .map((l) => num(l.amount))
      .filter((v): v is number => v !== null);
    if (subtotal === null || amounts.length === 0) return [];
    const sum = sumMinor(amounts);
    if (approxEqualMinor(sum, subtotal, invoice.lineItems.length || 1)) return [];
    return [
      {
        ruleId: 'R002',
        severity: 'error',
        fieldPath: 'subtotal',
        message: `Line amounts sum to ${sum.toFixed(2)}, but subtotal is ${subtotal.toFixed(2)}`,
        suggestion: sum.toFixed(2),
      },
    ];
  },
};

export const totalRule: Rule = {
  id: 'R003',
  severity: 'error',
  check: (invoice) => {
    const subtotal = num(invoice.subtotal);
    const tax = num(invoice.taxAmount);
    const total = num(invoice.total);
    if (subtotal === null || tax === null || total === null) return [];
    const expected = sumMinor([subtotal, tax]);
    if (approxEqualMinor(expected, total, 1)) return [];
    return [
      {
        ruleId: 'R003',
        severity: 'error',
        fieldPath: 'total',
        message: `subtotal + tax = ${expected.toFixed(2)}, but total is ${total.toFixed(2)}`,
        suggestion: expected.toFixed(2),
      },
    ];
  },
};

/** Most common per-line tax rate, when line rates exist. */
function dominantTaxRate(rates: number[]): number | null {
  if (rates.length === 0) return null;
  const counts = new Map<number, number>();
  for (const rate of rates) counts.set(rate, (counts.get(rate) ?? 0) + 1);
  let best = rates[0] ?? null;
  let bestCount = 0;
  for (const [rate, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      best = rate;
    }
  }
  return best;
}

export const taxConsistencyRule: Rule = {
  id: 'R004',
  severity: 'warning',
  check: (invoice) => {
    const subtotal = num(invoice.subtotal);
    const tax = num(invoice.taxAmount);
    const rates = invoice.lineItems
      .map((l) => num(l.taxRate))
      .filter((v): v is number => v !== null);
    const dominant = dominantTaxRate(rates);
    if (subtotal === null || tax === null || dominant === null) return [];
    const expected = subtotal * (dominant / 100);
    if (approxEqualMinor(expected, tax, 2)) return [];
    return [
      {
        ruleId: 'R004',
        severity: 'warning',
        fieldPath: 'taxAmount',
        message: `Tax at the dominant rate (${String(dominant)}%) would be ${expected.toFixed(2)}, but tax amount is ${tax.toFixed(2)}`,
        suggestion: expected.toFixed(2),
      },
    ];
  },
};

export const arithmeticRules: readonly Rule[] = [
  lineAmountRule,
  subtotalRule,
  totalRule,
  taxConsistencyRule,
];
