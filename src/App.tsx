import { useCallback } from 'react';
import styles from './App.module.css';
import { DeviceReport } from './ui/DeviceReport.tsx';
import { Footer } from './ui/Footer.tsx';
import { InferenceHarness } from './ui/InferenceHarness.tsx';
import { ModelDownloadGate } from './ui/ModelDownloadGate.tsx';
import { Welcome } from './ui/Welcome.tsx';

function useFlag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(name);
}

export function App(): React.JSX.Element {
  const diag = useFlag('diag');
  const model = useFlag('model');
  const harness = useFlag('harness');

  const onUpload = useCallback(() => {
    document.getElementById('faturlens-file-input')?.click();
  }, []);
  const onLoadDemos = useCallback(() => {
    void fetch('/demo/demo.json');
  }, []);

  const content = (
    <main className={styles.shell}>
      <h1 className={styles.title}>Faturlens</h1>
      <p className={styles.tagline}>
        Browser-native invoice OCR. Fully client-side — no data leaves your machine.
      </p>
      {diag ? <DeviceReport /> : null}
      {harness ? <InferenceHarness /> : <Welcome onUpload={onUpload} onLoadDemos={onLoadDemos} />}
      <Footer />
    </main>
  );

  return model ? <ModelDownloadGate>{content}</ModelDownloadGate> : content;
}
