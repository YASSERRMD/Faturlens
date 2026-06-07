// Shared invoice builders for export tests.
import type { Field, InvoiceV1, LineItem, Party } from '../../schema/invoice.ts';
import type { ExportInput } from './json.ts';

export function f<T>(value: T | null, confidence: Field<T>['confidence'] = 'extracted'): Field<T> {
  return { value, confidence };
}

export function party(o: Partial<Party> = {}): Party {
  return {
    name: f('Acme FZE'),
    address: f('Dubai'),
    trn: f('100123456700003'),
    phone: f<string>(null, 'missing'),
    email: f<string>(null, 'missing'),
    ...o,
  };
}

export function line(o: Partial<LineItem> = {}): LineItem {
  return {
    description: f('Widget'),
    quantity: f(2),
    unitPrice: f(50),
    amount: f(100),
    taxRate: f(5),
    ...o,
  };
}

export function makeInvoice(o: Partial<InvoiceV1> = {}): InvoiceV1 {
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

export function makeInput(o: Partial<ExportInput> = {}): ExportInput {
  return {
    invoice: makeInvoice(),
    verdict: 'clean',
    findings: [],
    promptVersions: { pass1: 'PASS1_PROMPT_V1', pass2: 'PASS2_PROMPT_V1' },
    edits: [],
    approved: true,
    exportedAt: '2026-06-07T00:00:00.000Z',
    ...o,
  };
}
