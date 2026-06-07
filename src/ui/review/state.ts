// Pure review state: an editable invoice, live validation, an edit audit trail,
// and approval gating. Kept framework-free so the logic is unit-tested directly.

import type { Field, InvoiceV1 } from '../../schema/invoice.ts';
import { validateInvoice, type RuleContext, type Validation } from '../../schema/rules/index.ts';

export interface EditEntry {
  fieldPath: string;
  before: string | number | null;
  after: string | number | null;
  at: number;
}

export interface ReviewState {
  invoice: InvoiceV1;
  validation: Validation;
  edits: EditEntry[];
  editedPaths: string[];
  approveWithWarnings: boolean;
  approved: boolean;
}

export type ReviewAction =
  | { type: 'editField'; path: string; value: string; at: number }
  | { type: 'addLine'; at: number }
  | { type: 'deleteLine'; index: number; at: number }
  | { type: 'setApproveWithWarnings'; value: boolean }
  | { type: 'approve' };

const NUMERIC_FIELD =
  /^(subtotal|taxAmount|total)$|^lineItems\.\d+\.(quantity|unitPrice|amount|taxRate)$/;

function isNumericPath(path: string): boolean {
  return NUMERIC_FIELD.test(path);
}

function parseValue(path: string, raw: string): string | number | null {
  if (raw === '') return null;
  if (isNumericPath(path)) {
    const n = Number.parseFloat(raw.replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}

type FieldHolder = Record<string, unknown>;

function getField(invoice: InvoiceV1, path: string): Field<string | number> | undefined {
  const segments = path.split('.');
  let current: unknown = invoice;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    if (Array.isArray(current)) {
      current = current[Number(segment)];
    } else {
      current = (current as FieldHolder)[segment];
    }
  }
  return current as Field<string | number> | undefined;
}

/** Read a field's current value for the audit trail. */
export function valueAtPath(invoice: InvoiceV1, path: string): string | number | null {
  return getField(invoice, path)?.value ?? null;
}

function revalidate(invoice: InvoiceV1, ctx: RuleContext): Validation {
  return validateInvoice(invoice, ctx);
}

export function initReviewState(invoice: InvoiceV1, ctx: RuleContext): ReviewState {
  return {
    invoice,
    validation: revalidate(invoice, ctx),
    edits: [],
    editedPaths: [],
    approveWithWarnings: false,
    approved: false,
  };
}

const emptyStringField = (): Field<string> => ({ value: null, confidence: 'missing' });
const emptyNumberField = (): Field<number> => ({ value: null, confidence: 'missing' });

function newLine(): InvoiceV1['lineItems'][number] {
  return {
    description: emptyStringField(),
    quantity: emptyNumberField(),
    unitPrice: emptyNumberField(),
    amount: emptyNumberField(),
  };
}

/** Whether the document can be approved: zero error-severity findings. */
export function canApprove(state: ReviewState): boolean {
  const hasError = state.validation.findings.some((f) => f.severity === 'error');
  if (hasError) return false;
  const hasWarning = state.validation.findings.some((f) => f.severity === 'warning');
  return !hasWarning || state.approveWithWarnings;
}

export function reviewReducer(
  state: ReviewState,
  action: ReviewAction,
  ctx: RuleContext,
): ReviewState {
  switch (action.type) {
    case 'editField': {
      const field = getField(state.invoice, action.path);
      if (!field) return state;
      const before = field.value;
      const after = parseValue(action.path, action.value);
      const invoice = structuredClone(state.invoice);
      const target = getField(invoice, action.path);
      if (target) {
        target.value = after;
        target.confidence = after === null ? 'missing' : 'extracted';
      }
      return {
        ...state,
        invoice,
        validation: revalidate(invoice, ctx),
        edits: [...state.edits, { fieldPath: action.path, before, after, at: action.at }],
        editedPaths: state.editedPaths.includes(action.path)
          ? state.editedPaths
          : [...state.editedPaths, action.path],
        approved: false,
      };
    }
    case 'addLine': {
      const invoice = structuredClone(state.invoice);
      invoice.lineItems.push(newLine());
      return {
        ...state,
        invoice,
        validation: revalidate(invoice, ctx),
        edits: [
          ...state.edits,
          {
            fieldPath: `lineItems.${String(invoice.lineItems.length - 1)}`,
            before: null,
            after: 'added',
            at: action.at,
          },
        ],
        approved: false,
      };
    }
    case 'deleteLine': {
      const invoice = structuredClone(state.invoice);
      invoice.lineItems.splice(action.index, 1);
      return {
        ...state,
        invoice,
        validation: revalidate(invoice, ctx),
        edits: [
          ...state.edits,
          {
            fieldPath: `lineItems.${String(action.index)}`,
            before: 'present',
            after: null,
            at: action.at,
          },
        ],
        approved: false,
      };
    }
    case 'setApproveWithWarnings':
      return { ...state, approveWithWarnings: action.value };
    case 'approve':
      return canApprove(state) ? { ...state, approved: true } : state;
    default:
      return state;
  }
}
