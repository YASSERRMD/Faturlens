import { describe, expect, it } from 'vitest';
import type { Field, InvoiceV1, LineItem, Party } from '../invoice.ts';
import { arithmeticRules } from './arithmetic.ts';
import { runRules, statusFor, type Rule, type RuleContext } from './engine.ts';
import { ALL_RULES, validateInvoice } from './index.ts';
import { regionalRules } from './regional.ts';
import { foldReviewState } from './review-state.ts';
import { sanityRules } from './sanity.ts';

const ctx: RuleContext = { today: new Date('2026-06-07T00:00:00Z') };

function f<T>(value: T | null, confidence: Field<T>['confidence'] = 'extracted'): Field<T> {
  return { value, confidence };
}

function party(overrides: Partial<Party> = {}): Party {
  return {
    name: f('Acme FZE'),
    address: f('Dubai, UAE'),
    trn: f('100123456700003'),
    phone: f<string>(null, 'missing'),
    email: f<string>(null, 'missing'),
    ...overrides,
  };
}

function line(overrides: Partial<LineItem> = {}): LineItem {
  return {
    description: f('Widget'),
    quantity: f(2),
    unitPrice: f(50),
    amount: f(100),
    taxRate: f(5),
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<InvoiceV1> = {}): InvoiceV1 {
  return {
    vendor: party(),
    invoiceNumber: f('INV-001'),
    issueDate: f('2026-01-15'),
    currency: f('AED'),
    lineItems: [line()],
    subtotal: f(100),
    taxAmount: f(5),
    total: f(105),
    uncertain: [],
    ...overrides,
  };
}

const ids = (rules: readonly Rule[], invoice: InvoiceV1): string[] =>
  runRules(invoice, rules, ctx).findings.map((x) => x.ruleId);

describe('engine', () => {
  it('a clean invoice produces zero findings and a clean verdict', () => {
    const v = validateInvoice(makeInvoice(), ctx);
    expect(v.findings).toHaveLength(0);
    expect(v.review.verdict).toBe('clean');
  });

  it('error overrides warning on the same field path', () => {
    const errorRule: Rule = {
      id: 'E',
      severity: 'error',
      check: () => [{ ruleId: 'E', severity: 'error', fieldPath: 'total', message: 'e' }],
    };
    const warnRule: Rule = {
      id: 'W',
      severity: 'warning',
      check: () => [{ ruleId: 'W', severity: 'warning', fieldPath: 'total', message: 'w' }],
    };
    const result = runRules(makeInvoice(), [warnRule, errorRule], ctx);
    expect(statusFor(result, 'total')).toBe('error');
    expect(statusFor(result, 'subtotal')).toBe('ok');
  });
});

describe('R001 line amount', () => {
  it('passes when qty × unit = amount', () => {
    expect(ids(arithmeticRules, makeInvoice())).not.toContain('R001');
  });
  it('tolerates a one-minor-unit rounding difference', () => {
    expect(
      ids(arithmeticRules, makeInvoice({ lineItems: [line({ amount: f(100.01) })] })),
    ).not.toContain('R001');
  });
  it('flags a wrong line amount', () => {
    expect(ids(arithmeticRules, makeInvoice({ lineItems: [line({ amount: f(90) })] }))).toContain(
      'R001',
    );
  });
  it('skips lines with missing values', () => {
    expect(
      ids(
        arithmeticRules,
        makeInvoice({ lineItems: [line({ quantity: f<number>(null, 'missing') })] }),
      ),
    ).not.toContain('R001');
  });
});

describe('R002 subtotal', () => {
  it('passes when line amounts sum to subtotal', () => {
    expect(ids(arithmeticRules, makeInvoice())).not.toContain('R002');
  });
  it('flags a wrong subtotal', () => {
    const inv = makeInvoice({ subtotal: f(80), total: f(85), taxAmount: f(5) });
    expect(ids(arithmeticRules, inv)).toContain('R002');
  });
});

describe('R003 total', () => {
  it('passes when subtotal + tax = total', () => {
    expect(ids(arithmeticRules, makeInvoice())).not.toContain('R003');
  });
  it('flags a wrong total', () => {
    expect(ids(arithmeticRules, makeInvoice({ total: f(999) }))).toContain('R003');
  });
});

describe('R004 tax consistency', () => {
  it('passes when tax matches the dominant rate', () => {
    expect(ids(arithmeticRules, makeInvoice())).not.toContain('R004');
  });
  it('flags tax that disagrees with the dominant line rate', () => {
    const inv = makeInvoice({ taxAmount: f(20), total: f(120) });
    expect(ids(arithmeticRules, inv)).toContain('R004');
  });
  it('uses the most common rate across mixed lines', () => {
    const inv = makeInvoice({
      lineItems: [line({ taxRate: f(5) }), line({ taxRate: f(5) }), line({ taxRate: f(0) })],
      subtotal: f(300),
      taxAmount: f(0),
      total: f(300),
    });
    // dominant rate 5% → expected 15, tax 0 → flagged
    expect(ids(arithmeticRules, inv)).toContain('R004');
  });
});

describe('R010 TRN', () => {
  it('passes a 15-digit TRN', () => {
    expect(ids(regionalRules, makeInvoice())).not.toContain('R010');
  });
  it('errors on a malformed TRN', () => {
    const inv = makeInvoice({ vendor: party({ trn: f('123') }) });
    const findings = runRules(inv, regionalRules, ctx).findings.filter((x) => x.ruleId === 'R010');
    expect(findings[0]?.severity).toBe('error');
  });
  it('warns when TRN is missing', () => {
    const inv = makeInvoice({ vendor: party({ trn: f<string>(null, 'missing') }) });
    const findings = runRules(inv, regionalRules, ctx).findings.filter((x) => x.ruleId === 'R010');
    expect(findings[0]?.severity).toBe('warning');
  });
});

describe('R011 VAT default', () => {
  it('passes at 5% in AED', () => {
    expect(ids(regionalRules, makeInvoice())).not.toContain('R011');
  });
  it('warns on a non-5% effective rate in AED', () => {
    expect(ids(regionalRules, makeInvoice({ taxAmount: f(10), total: f(110) }))).toContain('R011');
  });
  it('does not apply to non-AED currencies', () => {
    const inv = makeInvoice({ currency: f('USD'), taxAmount: f(10), total: f(110) });
    expect(ids(regionalRules, inv)).not.toContain('R011');
  });
});

describe('R012 currency whitelist', () => {
  it('accepts a preferred currency', () => {
    expect(ids(regionalRules, makeInvoice())).not.toContain('R012');
  });
  it('warns on a valid but non-preferred currency', () => {
    const inv = makeInvoice({ currency: f('JPY') });
    const findings = runRules(inv, regionalRules, ctx).findings.filter((x) => x.ruleId === 'R012');
    expect(findings[0]?.severity).toBe('warning');
  });
  it('errors on an invalid code', () => {
    const inv = makeInvoice({ currency: f('XYZ') });
    const findings = runRules(inv, regionalRules, ctx).findings.filter((x) => x.ruleId === 'R012');
    expect(findings[0]?.severity).toBe('error');
  });
});

describe('R020 date order', () => {
  it('passes when due ≥ issue', () => {
    expect(ids(sanityRules, makeInvoice({ dueDate: f('2026-02-15') }))).not.toContain('R020');
  });
  it('errors when due < issue', () => {
    expect(ids(sanityRules, makeInvoice({ dueDate: f('2026-01-01') }))).toContain('R020');
  });
});

describe('R021 date plausibility', () => {
  it('passes a current date', () => {
    expect(ids(sanityRules, makeInvoice())).not.toContain('R021');
  });
  it('accepts the 2000-01-01 boundary', () => {
    expect(ids(sanityRules, makeInvoice({ issueDate: f('2000-01-01') }))).not.toContain('R021');
  });
  it('errors before 2000', () => {
    expect(ids(sanityRules, makeInvoice({ issueDate: f('1999-12-31') }))).toContain('R021');
  });
  it('errors more than a year in the future', () => {
    expect(ids(sanityRules, makeInvoice({ issueDate: f('2028-01-01') }))).toContain('R021');
  });
});

describe('R022 non-negative', () => {
  it('passes positive values', () => {
    expect(ids(sanityRules, makeInvoice())).not.toContain('R022');
  });
  it('errors on a negative quantity', () => {
    const inv = makeInvoice({ lineItems: [line({ quantity: f(-1), amount: f(-50) })] });
    expect(ids(sanityRules, inv)).toContain('R022');
  });
});

describe('R023 empty line items', () => {
  it('errors when there are no items but a non-zero total', () => {
    expect(ids(sanityRules, makeInvoice({ lineItems: [], total: f(105) }))).toContain('R023');
  });
  it('passes when empty items and zero total', () => {
    expect(ids(sanityRules, makeInvoice({ lineItems: [], total: f(0) }))).not.toContain('R023');
  });
});

describe('R024 uncertain paths', () => {
  it('warns once per uncertain path', () => {
    const inv = makeInvoice({ uncertain: ['subtotal', 'vendor.name'] });
    const findings = runRules(inv, sanityRules, ctx).findings.filter((x) => x.ruleId === 'R024');
    expect(findings).toHaveLength(2);
  });
});

describe('review state', () => {
  it('clean with no findings', () => {
    const review = foldReviewState({ findings: [], fieldStatus: {} });
    expect(review.verdict).toBe('clean');
  });
  it('needs-review with only warnings', () => {
    const review = validateInvoice(makeInvoice({ currency: f('JPY') }), ctx).review;
    expect(review.verdict).toBe('needs-review');
  });
  it('needs-review and flags the money field on a wrong subtotal', () => {
    const v = validateInvoice(makeInvoice({ subtotal: f(80) }), ctx);
    expect(v.findings.some((x) => x.ruleId === 'R002')).toBe(true);
    expect(v.review.verdict).toBe('needs-review');
    expect(v.review.fieldsNeedingReview).toContain('subtotal');
  });
  it('rejected on a structural failure (empty items with a total)', () => {
    const v = validateInvoice(makeInvoice({ lineItems: [], subtotal: f(0), total: f(105) }), ctx);
    expect(v.review.verdict).toBe('rejected');
  });
});

describe('registry', () => {
  it('exposes all rule groups', () => {
    expect(ALL_RULES.length).toBe(
      arithmeticRules.length + regionalRules.length + sanityRules.length,
    );
  });
});
