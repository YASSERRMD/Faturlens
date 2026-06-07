import { useState } from 'react';
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
}

/** Split review surface: page image on the left, extracted form on the right. */
export function ReviewScreen({
  invoice,
  imageSrc,
  transcript,
  transcriptQuality,
  ctx,
}: ReviewScreenProps): React.JSX.Element {
  const { state, dispatch } = useReview(invoice, ctx);
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div>
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
