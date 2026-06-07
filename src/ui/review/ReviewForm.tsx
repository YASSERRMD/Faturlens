import { cx } from '../../lib/cx.ts';
import type { Finding } from '../../schema/rules/index.ts';
import { FieldRow } from './FieldRow.tsx';
import styles from './review.module.css';
import { canApprove, type ReviewState } from './state.ts';
import type { ReviewAction } from './state.ts';

export interface ReviewFormProps {
  state: ReviewState;
  dispatch: (action: ReviewAction) => void;
  now?: () => number;
}

const VENDOR_FIELDS: [string, string][] = [
  ['vendor.name', 'Name'],
  ['vendor.address', 'Address'],
  ['vendor.trn', 'TRN'],
  ['vendor.phone', 'Phone'],
  ['vendor.email', 'Email'],
];

const META_FIELDS: [string, string][] = [
  ['invoiceNumber', 'Invoice #'],
  ['issueDate', 'Issue date'],
  ['dueDate', 'Due date'],
  ['currency', 'Currency'],
];

const TOTAL_FIELDS: [string, string][] = [
  ['subtotal', 'Subtotal'],
  ['taxAmount', 'Tax'],
  ['total', 'Total'],
];

export function ReviewForm({ state, dispatch, now }: ReviewFormProps): React.JSX.Element {
  const clock = now ?? (() => Date.now());
  const { invoice, validation } = state;

  const findingsFor = (path: string): Finding[] =>
    validation.findings.filter((f) => f.fieldPath === path);
  const statusFor = (path: string) => validation.fieldStatus[path] ?? 'ok';
  const commit = (path: string, value: string): void => {
    dispatch({ type: 'editField', path, value, at: clock() });
  };

  const renderRows = (fields: [string, string][]): React.JSX.Element[] =>
    fields.map(([path, label]) => {
      const status = statusFor(path);
      return (
        <FieldRow
          key={path}
          path={path}
          label={label}
          value={valueOf(invoice, path)}
          status={status}
          findings={findingsFor(path)}
          edited={state.editedPaths.includes(path)}
          flagged={status !== 'ok'}
          onCommit={commit}
        />
      );
    });

  const verdict = validation.review.verdict;
  const verdictClass =
    verdict === 'clean'
      ? styles.verdictClean
      : verdict === 'rejected'
        ? styles.verdictRejected
        : styles.verdictNeedsReview;

  const warnings = validation.findings.some((f) => f.severity === 'warning');

  return (
    <div className={styles.form}>
      <section className={styles.group} aria-label="Vendor">
        <h3 className={styles.groupTitle}>Vendor</h3>
        {renderRows(VENDOR_FIELDS)}
      </section>

      <section className={styles.group} aria-label="Invoice meta">
        <h3 className={styles.groupTitle}>Invoice</h3>
        {renderRows(META_FIELDS)}
      </section>

      <section className={styles.group} aria-label="Line items">
        <h3 className={styles.groupTitle}>Line items</h3>
        <LineItems state={state} dispatch={dispatch} clock={clock} />
      </section>

      <section className={styles.group} aria-label="Totals">
        <h3 className={styles.groupTitle}>Totals</h3>
        {renderRows(TOTAL_FIELDS)}
      </section>

      <div className={styles.approvalBar}>
        <span className={cx(styles.verdict, verdictClass)}>{verdict}</span>
        {warnings ? (
          <label>
            <input
              type="checkbox"
              checked={state.approveWithWarnings}
              onChange={(e) => {
                dispatch({ type: 'setApproveWithWarnings', value: e.target.checked });
              }}
            />{' '}
            Approve with warnings
          </label>
        ) : null}
        <button
          type="button"
          className={styles.approveButton}
          disabled={!canApprove(state)}
          onClick={() => {
            dispatch({ type: 'approve' });
          }}
        >
          {state.approved ? 'Approved' : 'Approve'}
        </button>
      </div>
    </div>
  );
}

interface LineItemsProps {
  state: ReviewState;
  dispatch: (action: ReviewAction) => void;
  clock: () => number;
}

function LineItems({ state, dispatch, clock }: LineItemsProps): React.JSX.Element {
  const { invoice, validation } = state;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Amount</th>
          <th aria-label="actions" />
        </tr>
      </thead>
      <tbody>
        {invoice.lineItems.map((line, i) => {
          const qty = line.quantity.value;
          const unit = line.unitPrice.value;
          const amount = line.amount.value;
          const disagree =
            qty !== null &&
            unit !== null &&
            amount !== null &&
            Math.round(qty * unit * 100) !== Math.round(amount * 100);
          const cell = (key: string, value: string | number | null): React.JSX.Element => (
            <td className={cx(key === 'amount' && disagree && styles.disagree)}>
              <input
                className={styles.cellInput}
                aria-label={`line ${String(i + 1)} ${key}`}
                defaultValue={value === null ? '' : String(value)}
                onBlur={(e) => {
                  dispatch({
                    type: 'editField',
                    path: `lineItems.${String(i)}.${key}`,
                    value: e.target.value,
                    at: clock(),
                  });
                }}
              />
            </td>
          );
          return (
            <tr key={`${String(i)}-${String(invoice.lineItems.length)}`}>
              {cell('description', line.description.value)}
              {cell('quantity', qty)}
              {cell('unitPrice', unit)}
              {cell('amount', amount)}
              <td>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`delete line ${String(i + 1)}`}
                  onClick={() => {
                    dispatch({ type: 'deleteLine', index: i, at: clock() });
                  }}
                >
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={5}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => {
                dispatch({ type: 'addLine', at: clock() });
              }}
            >
              + Add row
            </button>
            {validation.fieldStatus.lineItems === 'error' ? (
              <span className={styles.findingError}> line items issue</span>
            ) : null}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function valueOf(invoice: ReviewState['invoice'], path: string): string | number | null {
  const segments = path.split('.');
  let current: unknown = invoice;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[segment];
  }
  const field = current as { value?: string | number | null } | undefined;
  return field?.value ?? null;
}
