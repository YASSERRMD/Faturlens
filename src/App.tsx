import styles from './App.module.css';
import { DeviceReport } from './ui/DeviceReport.tsx';
import { InferenceHarness } from './ui/InferenceHarness.tsx';
import { ModelDownloadGate } from './ui/ModelDownloadGate.tsx';

function useFlag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(name);
}

export function App(): React.JSX.Element {
  const diag = useFlag('diag');
  const model = useFlag('model');
  const harness = useFlag('harness');

  const content = (
    <main className={styles.shell}>
      <h1 className={styles.title}>Faturlens</h1>
      <p className={styles.tagline}>
        Browser-native invoice OCR. Fully client-side — no data leaves your machine.
      </p>
      {diag ? <DeviceReport /> : null}
      {harness ? <InferenceHarness /> : null}
    </main>
  );

  // The model gate is opt-in (?model) until later phases wire it into the
  // processing flow, so routine page loads do not trigger a multi-GB download.
  return model ? <ModelDownloadGate>{content}</ModelDownloadGate> : content;
}
