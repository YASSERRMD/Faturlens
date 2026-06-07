import styles from './App.module.css';
import { DeviceReport } from './ui/DeviceReport.tsx';

function useFlag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(name);
}

export function App(): React.JSX.Element {
  const diag = useFlag('diag');

  return (
    <main className={styles.shell}>
      <h1 className={styles.title}>Faturlens</h1>
      <p className={styles.tagline}>
        Browser-native invoice OCR. Fully client-side — no data leaves your machine.
      </p>
      {diag ? <DeviceReport /> : null}
    </main>
  );
}
