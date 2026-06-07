import styles from './Welcome.module.css';

export interface WelcomeProps {
  onLoadDemos: () => void;
  onUpload: () => void;
}

/** First-run welcome with a demo loader. */
export function Welcome({ onLoadDemos, onUpload }: WelcomeProps): React.JSX.Element {
  return (
    <section className={styles.welcome}>
      <h2>Welcome to Faturlens</h2>
      <p>
        Drop an invoice (PNG, JPEG, WebP, or PDF) and Faturlens extracts structured data entirely on
        your device — no server, no upload, no data leaving your machine.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onUpload}>
          Upload an invoice
        </button>
        <button type="button" className={styles.secondary} onClick={onLoadDemos}>
          Load demo invoices
        </button>
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
