import { useRef, useState } from 'react';
import styles from './App.module.css';
import type { InvoiceV1 } from './schema/invoice.ts';
import type { Demo } from './ui/demos.ts';
import { DeviceReport } from './ui/DeviceReport.tsx';
import { Footer } from './ui/Footer.tsx';
import { InferenceHarness } from './ui/InferenceHarness.tsx';
import { ModelDownloadGate } from './ui/ModelDownloadGate.tsx';
import { ReviewScreen } from './ui/review/ReviewScreen.tsx';
import { emptyInvoice, uploadToImage } from './ui/upload.ts';
import { FailureCard, Welcome } from './ui/Welcome.tsx';

function useFlag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has(name);
}

type View = { kind: 'home' } | { kind: 'review'; invoice: InvoiceV1; imageSrc: string };

export function App(): React.JSX.Element {
  const diag = useFlag('diag');
  const model = useFlag('model');
  const harness = useFlag('harness');

  const [view, setView] = useState<View>({ kind: 'home' });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openDemo = (demo: Demo): void => {
    setError(null);
    setView({ kind: 'review', invoice: demo.invoice, imageSrc: demo.imageSrc });
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    void uploadToImage(file).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setView({ kind: 'review', invoice: emptyInvoice(), imageSrc: result.imageSrc });
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

  const content = (
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
          {error ? <FailureCard title="Could not open that file" message={error} /> : null}
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

  return model ? <ModelDownloadGate>{content}</ModelDownloadGate> : content;
}
