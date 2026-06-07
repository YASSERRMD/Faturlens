import { useEffect, useState } from 'react';
import { cx } from '../../lib/cx.ts';
import type { Finding, FieldStatus } from '../../schema/rules/index.ts';
import styles from './review.module.css';

export interface FieldRowProps {
  label: string;
  path: string;
  value: string | number | null;
  status: FieldStatus;
  findings: Finding[];
  edited: boolean;
  flagged: boolean;
  onCommit: (path: string, value: string) => void;
}

const dotClass: Record<FieldStatus, string> = {
  ok: styles.dotOk ?? '',
  warning: styles.dotWarning ?? '',
  error: styles.dotError ?? '',
};

export function FieldRow({
  label,
  path,
  value,
  status,
  findings,
  edited,
  flagged,
  onCommit,
}: FieldRowProps): React.JSX.Element {
  const initial = value === null ? '' : String(value);
  const [draft, setDraft] = useState(initial);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const commit = (): void => {
    if (draft !== initial) onCommit(path, draft);
  };

  return (
    <>
      <div className={styles.row}>
        <span className={styles.label}>
          <span
            className={cx(styles.dot, dotClass[status])}
            aria-label={`status: ${status}`}
            role="img"
          />
          {label}
          {edited ? (
            <span className={styles.edited} title="edited">
              ✎
            </span>
          ) : null}
        </span>
        <input
          className={cx(
            styles.input,
            status === 'error' && styles.inputError,
            status === 'warning' && styles.inputWarning,
          )}
          value={draft}
          aria-label={label}
          data-flagged={flagged ? 'true' : undefined}
          tabIndex={flagged ? 0 : -1}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onFocus={() => {
            setFocused(true);
          }}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              setDraft(initial);
            }
          }}
        />
      </div>
      {focused && findings.length > 0 ? (
        <ul className={styles.findings}>
          {findings.map((finding) => (
            <li
              key={finding.ruleId + finding.fieldPath}
              className={finding.severity === 'error' ? styles.findingError : styles.findingWarning}
            >
              {finding.message}
              {finding.suggestion !== undefined ? ` (suggested: ${finding.suggestion})` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
