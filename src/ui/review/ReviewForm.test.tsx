import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Field, InvoiceV1, LineItem, Party } from '../../schema/invoice.ts';
import type { RuleContext } from '../../schema/rules/index.ts';
import { ReviewForm } from './ReviewForm.tsx';
import { useReview } from './useReview.ts';

const ctx: RuleContext = { today: new Date('2026-06-07T00:00:00Z') };

function f<T>(value: T | null, confidence: Field<T>['confidence'] = 'extracted'): Field<T> {
  return { value, confidence };
}
function party(): Party {
  return {
    name: f('Acme FZE'),
    address: f('Dubai'),
    trn: f('100123456700003'),
    phone: f<string>(null, 'missing'),
    email: f<string>(null, 'missing'),
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

function Harness({ invoice }: { invoice: InvoiceV1 }): React.JSX.Element {
  const { state, dispatch } = useReview(invoice, ctx);
  return <ReviewForm state={state} dispatch={dispatch} now={() => 1} />;
}

describe('ReviewForm', () => {
  it('renders error status on a field with a failing rule', () => {
    render(<Harness invoice={makeInvoice({ subtotal: f(80) })} />);
    const dots = screen.getAllByLabelText('status: error');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('blocks approval while an error exists and enables it after a live fix', async () => {
    const user = userEvent.setup();
    render(<Harness invoice={makeInvoice({ subtotal: f(80) })} />);
    const approve = screen.getByRole('button', { name: /approve/i });
    expect(approve).toBeDisabled();

    const subtotal = screen.getByLabelText('Subtotal');
    await user.clear(subtotal);
    await user.type(subtotal, '100');
    await user.tab(); // blur commits → live revalidation

    expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled();
  });

  it('requires acknowledging warnings before approval', async () => {
    const user = userEvent.setup();
    render(<Harness invoice={makeInvoice({ currency: f('JPY') })} />);
    const approve = screen.getByRole('button', { name: /approve/i });
    expect(approve).toBeDisabled();

    await user.click(screen.getByLabelText(/approve with warnings/i));
    expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled();
  });

  it('deletes a line item', async () => {
    const user = userEvent.setup();
    render(<Harness invoice={makeInvoice({ lineItems: [line(), line()] })} />);
    expect(screen.getAllByLabelText(/^line \d+ description$/)).toHaveLength(2);
    await user.click(screen.getByLabelText('delete line 2'));
    expect(screen.getAllByLabelText(/^line \d+ description$/)).toHaveLength(1);
  });
});
