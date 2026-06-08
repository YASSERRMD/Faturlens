import { useRef, useState } from 'react';
import styles from './App.module.css';
import { useDeviceProfile } from './capability/useDeviceProfile.tsx';
import { formatPercent } from './lib/format.ts';
import type { InvoiceV1 } from './schema/invoice.ts';
import type { Demo } from './ui/demos.ts';
import { DeviceReport } from './ui/DeviceReport.tsx';
import { Footer } from './ui/Footer.tsx';
import { InferenceHarness } from './ui/InferenceHarness.tsx';
import { processInvoice, type ProcessStage } from './ui/process.ts';
import { ReviewScreen } from './ui/review/ReviewScreen.tsx';
import { FailureCard, Welcome } from './ui/Welcome.tsx';

function useFlag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(name);
}

type View =
  | { kind: 'home' }
  | { kind: 'processing' }
  | { kind: 'review'; invoice: InvoiceV1; imageSrc: string };

const STAGE_LABEL: Record<ProcessStage, string> = {
  ingesting: 'Reading the file…',
  'loading-model': 'Loading the model (first run downloads ~2.5 GB, then cached offline)…',
  extracting: 'Extracting invoice data…',
  done: 'Done',
};

export function App(): React.JSX.Element {
  const diag = useFlag('diag');
  const harness = useFlag('harness');
  const { profile } = useDeviceProfile();

  const [view, setView] = useState<View>({ kind: 'home' });
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ProcessStage>('ingesting');
  const [loadFraction, setLoadFraction] = useState(0);
  const [stream, setStream] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const openDemo = (demo: Demo): void => {
    setError(null);
    setView({ kind: 'review', invoice: demo.invoice, imageSrc: demo.imageSrc });
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !profile) return;
    setError(null);
    setStream('');
    setLoadFraction(0);
    setView({ kind: 'processing' });

    processInvoice(file, profile, {
      onStage: setStage,
      onLoadProgress: setLoadFraction,
      onToken: (chunk) => {
        setStream((prev) => (prev + chunk).slice(-4000));
      },
    })
      .then((result) => {
        setView({ kind: 'review', invoice: result.invoice, imageSrc: result.imageSrc });
        if (!result.extracted) {
          setError(`Extraction did not return valid data: ${result.rawText}`);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setView({ kind: 'home' });
      });
  };

  if (view.kind === 'review') {
    return (
      <main className={styles.shellWide}>
        <ReviewScreen
          invoice={view.invoice}
          imageSrc={view.imageSrc}
          onBack={() => {
            setView({ kind: 'home' });
          }}
        />
      </main>
    );
  }

  if (view.kind === 'processing') {
    return (
      <main className={styles.shell}>
        <h1 className={styles.title}>Faturlens</h1>
        <section className={styles.processing}>
          <p className={styles.stageLabel}>{STAGE_LABEL[stage]}</p>
          {stage === 'loading-model' && loadFraction > 0 ? (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: formatPercent(loadFraction) }} />
            </div>
          ) : null}
          {stream ? <pre className={styles.streamOut}>{stream}</pre> : null}
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <h1 className={styles.title}>Faturlens</h1>
      <p className={styles.tagline}>
        Browser-native invoice OCR. Fully client-side — no data leaves your machine.
      </p>
      {diag ? <DeviceReport /> : null}
      {harness ? (
        <InferenceHarness />
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
          {error ? <FailureCard title="Could not process that file" message={error} /> : null}
          <Welcome
            onUpload={() => {
              fileRef.current?.click();
            }}
            onOpenDemo={openDemo}
          />
        </>
      )}
      <Footer />
    </main>
  );
}
