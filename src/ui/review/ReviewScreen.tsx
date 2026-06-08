import { useState } from 'react';
import { headerCsv, exportInvoiceJson, type ExportInput } from '../../lib/export/index.ts';
import { MODEL_ID, PROMPT_VERSIONS } from '../../lib/version.ts';
import type { QualityReport } from '../../pipeline/pass1/quality.ts';
import type { InvoiceV1 } from '../../schema/invoice.ts';
import type { RuleContext } from '../../schema/rules/index.ts';
import { TranscriptPane } from '../TranscriptPane.tsx';
import { ImageViewer } from './ImageViewer.tsx';
import styles from './review.module.css';
import { ReviewForm } from './ReviewForm.tsx';
import { useReview } from './useReview.ts';

export interface ReviewScreenProps {
  invoice: InvoiceV1;
  imageSrc: string;
  transcript?: string;
  transcriptQuality?: QualityReport;
  ctx?: RuleContext;
  onBack?: () => void;
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Split review surface: page image on the left, extracted form on the right. */
export function ReviewScreen({
  invoice,
  imageSrc,
  transcript,
  transcriptQuality,
  ctx,
  onBack,
}: ReviewScreenProps): React.JSX.Element {
  const { state, dispatch } = useReview(invoice, ctx);
  const [showTranscript, setShowTranscript] = useState(false);

  const exportInput = (): ExportInput => ({
    invoice: state.invoice,
    verdict: state.validation.review.verdict,
    findings: state.validation.findings,
    promptVersions: { pass1: PROMPT_VERSIONS.pass1, pass2: PROMPT_VERSIONS.pass2 },
    edits: state.edits,
    approved: state.approved,
    exportedAt: new Date().toISOString(),
  });

  const exportJson = (): void => {
    download('faturlens-invoice.json', exportInvoiceJson(exportInput()), 'application/json');
  };
  const exportCsv = (): void => {
    download('faturlens-invoice.csv', headerCsv([state.invoice]), 'text/csv');
  };

  return (
    <div>
      <div className={styles.toolbar}>
        {onBack ? (
          <button type="button" className={styles.iconButton} onClick={onBack}>
            ← Back
          </button>
        ) : null}
        <span className={styles.spacerFlex} />
        <span className={styles.modelTag}>{MODEL_ID}</span>
        <button type="button" className={styles.iconButton} onClick={exportJson}>
          Export JSON
        </button>
        <button type="button" className={styles.iconButton} onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      <div className={styles.screen}>
        <div>
          <ImageViewer src={imageSrc} />
          {transcript !== undefined ? (
            <div className={styles.drawer}>
              <button
                type="button"
                className={styles.drawerToggle}
                onClick={() => {
                  setShowTranscript((v) => !v);
                }}
                aria-expanded={showTranscript}
              >
                {showTranscript ? '▾ Hide transcript' : '▸ Show transcript'}
              </button>
              {showTranscript ? (
                <TranscriptPane
                  markdown={transcript}
                  {...(transcriptQuality ? { quality: transcriptQuality } : {})}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <ReviewForm state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}
