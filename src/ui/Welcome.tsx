import { DEMOS, type Demo } from './demos.ts';
import styles from './Welcome.module.css';

export interface WelcomeProps {
  onUpload: () => void;
  onOpenDemo: (demo: Demo) => void;
}

/** First-run welcome: upload an invoice or open one of the offline demos. */
export function Welcome({ onUpload, onOpenDemo }: WelcomeProps): React.JSX.Element {
  return (
    <section className={styles.welcome}>
      <h2>Welcome to Faturlens</h2>
      <p>
        Upload an invoice (PNG, JPEG, WebP, or PDF) to review and validate it on your device — no
        server, no upload, no data leaving your machine. Or open a demo below to see the review and
        validation layer in action instantly (no model download).
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onUpload}>
          Upload an invoice
        </button>
      </div>
      <div className={styles.demos}>
        {DEMOS.map((demo) => (
          <button
            key={demo.id}
            type="button"
            className={styles.demoChip}
            onClick={() => {
              onOpenDemo(demo);
            }}
          >
            {demo.title}
          </button>
        ))}
      </div>
    </section>
  );
}

export interface FailureCardProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

/** Friendly failure card (unsupported browser, denied storage, fetch failure). */
export function FailureCard({ title, message, onRetry }: FailureCardProps): React.JSX.Element {
  return (
    <div className={styles.card} role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
