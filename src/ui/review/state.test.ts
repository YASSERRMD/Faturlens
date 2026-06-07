import { describe, expect, it } from 'vitest';
import type { Field, InvoiceV1, LineItem, Party } from '../../schema/invoice.ts';
import type { RuleContext } from '../../schema/rules/index.ts';
import {
  canApprove,
  initReviewState,
  reviewReducer,
  valueAtPath,
  type ReviewState,
} from './state.ts';

const ctx: RuleContext = { today: new Date('2026-06-07T00:00:00Z') };

function f<T>(value: T | null, confidence: Field<T>['confidence'] = 'extracted'): Field<T> {
  return { value, confidence };
}
function party(o: Partial<Party> = {}): Party {
  return {
    name: f('Acme FZE'),
    address: f('Dubai'),
    trn: f('100123456700003'),
    phone: f<string>(null, 'missing'),
    email: f<string>(null, 'missing'),
    ...o,
  };
}
function line(o: Partial<LineItem> = {}): LineItem {
  return {
    description: f('Widget'),
    quantity: f(2),
    unitPrice: f(50),
    amount: f(100),
    taxRate: f(5),
    ...o,
  };
}
function makeInvoice(o: Partial<InvoiceV1> = {}): InvoiceV1 {
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
    ...o,
  };
}

const init = (inv: InvoiceV1): ReviewState => initReviewState(inv, ctx);

describe('reviewReducer — live revalidation', () => {
  it('clears R002 when a wrong subtotal is corrected', () => {
    let state = init(makeInvoice({ subtotal: f(80) }));
    expect(state.validation.findings.some((x) => x.ruleId === 'R002')).toBe(true);
    expect(canApprove(state)).toBe(false);

    state = reviewReducer(state, { type: 'editField', path: 'subtotal', value: '100', at: 1 }, ctx);
    expect(state.validation.findings.some((x) => x.ruleId === 'R002')).toBe(false);
  });

  it('records an audit entry with before/after and marks the path edited', () => {
    let state = init(makeInvoice({ subtotal: f(80) }));
    state = reviewReducer(
      state,
      { type: 'editField', path: 'subtotal', value: '100', at: 42 },
      ctx,
    );
    expect(state.edits).toHaveLength(1);
    expect(state.edits[0]).toEqual({ fieldPath: 'subtotal', before: 80, after: 100, at: 42 });
    expect(state.editedPaths).toContain('subtotal');
  });

  it('reads values by path for the audit trail', () => {
    expect(valueAtPath(makeInvoice(), 'subtotal')).toBe(100);
    expect(valueAtPath(makeInvoice(), 'vendor.name')).toBe('Acme FZE');
    expect(valueAtPath(makeInvoice(), 'lineItems.0.amount')).toBe(100);
  });
});

describe('approval gating', () => {
  it('blocks approval while an error finding exists', () => {
    const state = init(makeInvoice({ total: f(999) }));
    expect(canApprove(state)).toBe(false);
    const after = reviewReducer(state, { type: 'approve' }, ctx);
    expect(after.approved).toBe(false);
  });

  it('requires acknowledgment to approve with warnings', () => {
    let state = init(makeInvoice({ currency: f('JPY') })); // R012 warning
    expect(canApprove(state)).toBe(false);
    state = reviewReducer(state, { type: 'setApproveWithWarnings', value: true }, ctx);
    expect(canApprove(state)).toBe(true);
    state = reviewReducer(state, { type: 'approve' }, ctx);
    expect(state.approved).toBe(true);
  });

  it('approves a clean invoice directly', () => {
    let state = init(makeInvoice());
    expect(canApprove(state)).toBe(true);
    state = reviewReducer(state, { type: 'approve' }, ctx);
    expect(state.approved).toBe(true);
  });
});

describe('line item editing', () => {
  it('adds and deletes line items, revalidating each time', () => {
    let state = init(makeInvoice());
    state = reviewReducer(state, { type: 'addLine', at: 1 }, ctx);
    expect(state.invoice.lineItems).toHaveLength(2);
    state = reviewReducer(state, { type: 'deleteLine', index: 1, at: 2 }, ctx);
    expect(state.invoice.lineItems).toHaveLength(1);
    expect(state.edits).toHaveLength(2);
  });
});
