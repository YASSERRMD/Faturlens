import { useMemo, useState } from 'react';
import { cx } from '../lib/cx.ts';
import { renderMarkdownToHtml } from '../lib/markdown.ts';
import type { QualityReport, QualityVerdict } from '../pipeline/pass1/quality.ts';
import styles from './TranscriptPane.module.css';

const badgeClass: Record<QualityVerdict, string> = {
  ok: styles.ok ?? '',
  suspect: styles.suspect ?? '',
  failed: styles.failed ?? '',
};

export interface TranscriptPaneProps {
  markdown: string;
  quality?: QualityReport;
}

/** Streaming-friendly transcript view with a quality badge and raw/rendered toggle. */
export function TranscriptPane({ markdown, quality }: TranscriptPaneProps): React.JSX.Element {
  const [raw, setRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown]);

  const copy = (): void => {
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (!clipboard) return;
    void clipboard.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  };

  return (
    <section className={styles.pane} aria-label="Transcript">
      <div className={styles.bar}>
        {quality ? (
          <span
            className={cx(styles.badge, badgeClass[quality.verdict])}
            title={quality.reasons.join('; ')}
          >
            {quality.verdict}
          </span>
        ) : null}
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => {
            setRaw((v) => !v);
          }}
        >
          {raw ? 'Rendered' : 'Raw'}
        </button>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className={styles.body}>
        {raw ? (
          <pre className={styles.raw}>{markdown || '—'}</pre>
        ) : (
          // Safe: renderMarkdownToHtml HTML-escapes all content before formatting.
          <div dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </section>
  );
}
