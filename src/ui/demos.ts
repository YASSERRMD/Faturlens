// Demo invoices that work entirely offline (no model download). Each carries a
// hardcoded InvoiceV1 plus a rendered SVG image, so the review/validation/export
// experience is fully exercisable — including the broken-math showcase.

import type { Field, InvoiceV1, LineItem, Party } from '../schema/invoice.ts';

function f<T>(value: T | null, confidence: Field<T>['confidence'] = 'extracted'): Field<T> {
  return { value, confidence };
}

function party(name: string, trn: string | null, address: string): Party {
  return {
    name: f(name),
    address: f(address),
    trn: trn === null ? f<string>(null, 'missing') : f(trn),
    phone: f<string>(null, 'missing'),
    email: f<string>(null, 'missing'),
  };
}

function li(description: string, quantity: number, unitPrice: number, amount: number): LineItem {
  return {
    description: f(description),
    quantity: f(quantity),
    unitPrice: f(unitPrice),
    amount: f(amount),
    taxRate: f(5),
  };
}

export interface Demo {
  id: string;
  title: string;
  invoice: InvoiceV1;
  imageSrc: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(field: Field<number>): string {
  return field.value === null ? '—' : field.value.toFixed(2);
}

/** Render an invoice as an SVG data URL so the ImageViewer has something to show. */
function renderSvg(invoice: InvoiceV1): string {
  const rows = invoice.lineItems
    .map((line, i) => {
      const y = 250 + i * 30;
      return `
        <text x="50" y="${String(y)}" font-size="15">${escapeXml(line.description.value ?? '')}</text>
        <text x="430" y="${String(y)}" font-size="15" text-anchor="end">${num(line.quantity)}</text>
        <text x="560" y="${String(y)}" font-size="15" text-anchor="end">${num(line.unitPrice)}</text>
        <text x="700" y="${String(y)}" font-size="15" text-anchor="end">${num(line.amount)}</text>`;
    })
    .join('');
  const totalsY = 250 + invoice.lineItems.length * 30 + 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="600" viewBox="0 0 760 600">
    <rect width="760" height="600" fill="#ffffff"/>
    <rect width="760" height="90" fill="#1B2A4A"/>
    <text x="50" y="45" fill="#ffffff" font-family="Georgia, serif" font-size="26" font-weight="bold">${escapeXml(invoice.vendor.name.value ?? 'Vendor')}</text>
    <text x="50" y="72" fill="#C5A55A" font-family="Arial" font-size="13">TRN: ${escapeXml(invoice.vendor.trn.value ?? '—')}  ·  ${escapeXml(invoice.vendor.address.value ?? '')}</text>
    <text x="50" y="130" font-family="Arial" font-size="14">Invoice #: ${escapeXml(invoice.invoiceNumber.value ?? '—')}   Date: ${escapeXml(invoice.issueDate.value ?? '—')}   Currency: ${escapeXml(invoice.currency.value ?? '—')}</text>
    <line x1="50" y1="200" x2="710" y2="200" stroke="#C5A55A" stroke-width="2"/>
    <text x="50" y="190" font-family="Arial" font-size="13" font-weight="bold">Description</text>
    <text x="430" y="190" font-family="Arial" font-size="13" font-weight="bold" text-anchor="end">Qty</text>
    <text x="560" y="190" font-family="Arial" font-size="13" font-weight="bold" text-anchor="end">Unit</text>
    <text x="700" y="190" font-family="Arial" font-size="13" font-weight="bold" text-anchor="end">Amount</text>
    <g font-family="Arial" fill="#2C2C2C">${rows}</g>
    <line x1="430" y1="${String(totalsY - 28)}" x2="710" y2="${String(totalsY - 28)}" stroke="#ddd"/>
    <g font-family="Arial" font-size="14" fill="#2C2C2C">
      <text x="560" y="${String(totalsY)}" text-anchor="end">Subtotal</text>
      <text x="700" y="${String(totalsY)}" text-anchor="end">${num(invoice.subtotal)}</text>
      <text x="560" y="${String(totalsY + 26)}" text-anchor="end">Tax</text>
      <text x="700" y="${String(totalsY + 26)}" text-anchor="end">${num(invoice.taxAmount)}</text>
      <text x="560" y="${String(totalsY + 54)}" text-anchor="end" font-weight="bold">Total</text>
      <text x="700" y="${String(totalsY + 54)}" text-anchor="end" font-weight="bold">${num(invoice.total)}</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function withImage(id: string, title: string, invoice: InvoiceV1): Demo {
  return { id, title, invoice, imageSrc: renderSvg(invoice) };
}

const cleanEn: InvoiceV1 = {
  vendor: party('Acme Trading FZE', '100123456700003', 'Dubai, UAE'),
  invoiceNumber: f('INV-2026-0042'),
  issueDate: f('2026-01-15'),
  dueDate: f('2026-02-14'),
  currency: f('AED'),
  lineItems: [li('Consulting services', 10, 150, 1500), li('Support package', 2, 250, 500)],
  subtotal: f(2000),
  taxAmount: f(100),
  total: f(2100),
  uncertain: [],
};

const bilingual: InvoiceV1 = {
  vendor: party('Emirates Trading LLC / الإمارات', '100987654300003', 'Dubai, UAE'),
  invoiceNumber: f('INV-AE-7781'),
  issueDate: f('2026-03-03'),
  currency: f('AED'),
  lineItems: [li('Advisory / استشارات', 4, 300, 1200), li('Equipment / معدات', 1, 800, 800)],
  subtotal: f(2000),
  taxAmount: f(100),
  total: f(2100),
  uncertain: [],
};

const multipage: InvoiceV1 = {
  vendor: party('Globex Industrial', '100222333400003', 'Abu Dhabi, UAE'),
  invoiceNumber: f('GLX-5500'),
  issueDate: f('2026-04-10'),
  currency: f('USD'),
  lineItems: [
    li('Steel beams', 20, 75, 1500),
    li('Fasteners', 100, 2.5, 250),
    li('Coating service', 1, 300, 300),
  ],
  subtotal: f(2050),
  taxAmount: f(0),
  total: f(2050),
  uncertain: [],
};

// Deliberately broken: line amounts sum to 1200, but subtotal says 1000 and the
// total ignores tax → R002 + R003 errors → needs-review with red fields.
const brokenMath: InvoiceV1 = {
  vendor: party('Initech Solutions', '100555666700003', 'Sharjah, UAE'),
  invoiceNumber: f('INI-9001'),
  issueDate: f('2026-05-20'),
  currency: f('AED'),
  lineItems: [li('Software license', 3, 200, 700), li('Onboarding', 1, 500, 500)],
  subtotal: f(1000),
  taxAmount: f(60),
  total: f(1500),
  uncertain: ['subtotal'],
};

export const DEMOS: Demo[] = [
  withImage('clean-en', 'Clean English invoice', cleanEn),
  withImage('bilingual', 'Bilingual Arabic–English', bilingual),
  withImage('multipage', 'Multi-line invoice', multipage),
  withImage('broken-math', 'Broken-math (validation demo)', brokenMath),
];
