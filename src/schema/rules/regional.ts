// Regional rules (UAE-focused, locale-groupable). Grouped separately so a future
// settings screen can toggle locales.

import { num, str, type Rule } from './engine.ts';
import { approxEqualMinor } from './money.ts';

const PREFERRED_CURRENCIES = new Set(['AED', 'USD', 'EUR', 'SAR', 'GBP', 'INR']);

// A pragmatic ISO 4217 set for "valid but non-preferred" classification.
const ISO_4217 = new Set([
  'AED',
  'USD',
  'EUR',
  'SAR',
  'GBP',
  'INR',
  'JPY',
  'CNY',
  'CHF',
  'CAD',
  'AUD',
  'KWD',
  'BHD',
  'OMR',
  'QAR',
  'EGP',
  'PKR',
  'BDT',
  'LKR',
  'SGD',
  'HKD',
  'MYR',
  'ZAR',
  'TRY',
  'RUB',
  'BRL',
  'MXN',
  'NZD',
  'SEK',
  'NOK',
  'DKK',
  'PLN',
  'THB',
  'IDR',
  'PHP',
  'KRW',
]);

const UAE_VAT_RATE = 5; // percent

export const trnFormatRule: Rule = {
  id: 'R010',
  severity: 'error',
  check: (invoice) => {
    const trn = str(invoice.vendor.trn);
    if (trn === null) {
      return [
        {
          ruleId: 'R010',
          severity: 'warning',
          fieldPath: 'vendor.trn',
          message: 'Vendor TRN is missing',
        },
      ];
    }
    if (!/^\d{15}$/.test(trn.trim())) {
      return [
        {
          ruleId: 'R010',
          severity: 'error',
          fieldPath: 'vendor.trn',
          message: `TRN "${trn}" is not 15 digits`,
        },
      ];
    }
    return [];
  },
};

export const vatDefaultRule: Rule = {
  id: 'R011',
  severity: 'warning',
  check: (invoice) => {
    const currency = str(invoice.currency);
    const subtotal = num(invoice.subtotal);
    const tax = num(invoice.taxAmount);
    if (currency !== 'AED' || subtotal === null || tax === null || subtotal === 0) return [];
    const expected = subtotal * (UAE_VAT_RATE / 100);
    if (approxEqualMinor(expected, tax, 2)) return [];
    const effective = (tax / subtotal) * 100;
    return [
      {
        ruleId: 'R011',
        severity: 'warning',
        fieldPath: 'taxAmount',
        message: `Effective VAT is ${effective.toFixed(1)}%; UAE invoices typically use ${String(UAE_VAT_RATE)}%`,
      },
    ];
  },
};

export const currencyWhitelistRule: Rule = {
  id: 'R012',
  severity: 'warning',
  check: (invoice) => {
    const currency = str(invoice.currency);
    if (currency === null) return [];
    const code = currency.trim().toUpperCase();
    if (PREFERRED_CURRENCIES.has(code)) return [];
    if (ISO_4217.has(code)) {
      return [
        {
          ruleId: 'R012',
          severity: 'warning',
          fieldPath: 'currency',
          message: `Currency ${code} is valid but outside the common set`,
        },
      ];
    }
    return [
      {
        ruleId: 'R012',
        severity: 'error',
        fieldPath: 'currency',
        message: `"${currency}" is not a recognized ISO 4217 currency code`,
      },
    ];
  },
};

export const regionalRules: readonly Rule[] = [
  trnFormatRule,
  vatDefaultRule,
  currencyWhitelistRule,
];
