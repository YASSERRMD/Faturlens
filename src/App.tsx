import styles from './App.module.css';

export function App(): React.JSX.Element {
  return (
    <main className={styles.shell}>
      <h1 className={styles.title}>Faturlens</h1>
      <p className={styles.tagline}>
        Browser-native invoice OCR. Fully client-side — no data leaves your machine.
      </p>
    </main>
  );
}
