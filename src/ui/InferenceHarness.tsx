import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeviceProfile } from '../capability/useDeviceProfile.tsx';
import { cx } from '../lib/cx.ts';
import { ingestFile, preprocessPage } from '../pipeline/ingest/ingest.ts';
import {
  createInferenceClient,
  type InferenceClient,
  type InferenceHandle,
  type InferenceResult,
} from '../worker/client.ts';
import styles from './InferenceHarness.module.css';

/**
 * Manual test rig (behind `?harness`): prompt + image input, run button,
 * streaming output, and a stats readout. The integration surface for every
 * downstream pipeline phase.
 */
export function InferenceHarness(): React.JSX.Element {
  const { profile } = useDeviceProfile();
  const [prompt, setPrompt] = useState('Transcribe this image to markdown.');
  const [files, setFiles] = useState<File[]>([]);
  const [output, setOutput] = useState('');
  const [stats, setStats] = useState<InferenceResult['stats'] | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<InferenceClient | null>(null);
  const handleRef = useRef<InferenceHandle | null>(null);

  useEffect(() => {
    return () => clientRef.current?.dispose();
  }, []);

  const run = useCallback(async () => {
    if (!profile) return;
    setError(null);
    setOutput('');
    setStats(null);
    setRunning(true);
    try {
      clientRef.current ??= createInferenceClient();
      const client = clientRef.current;
      await client.load(profile);

      // Ingest the first file (image or PDF), tile its first page to budget.
      let images: ImageBitmap[] = [];
      const first = files[0];
      if (first) {
        const ingested = await ingestFile(first);
        if (!ingested.ok) throw new Error(ingested.rejection.message);
        const page = await ingested.document.getPage(0);
        const processed = await preprocessPage(page, profile.maxTilesPerPage);
        images = processed.thumbnail ? [...processed.tiles, processed.thumbnail] : processed.tiles;
      }

      const handle = client.infer({ images, prompt, maxNewTokens: 1024 });
      handleRef.current = handle;
      for await (const token of handle) setOutput((prev) => prev + token);
      setStats((await handle.completed).stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [profile, files, prompt]);

  return (
    <section className={styles.harness} aria-label="Inference harness">
      <div className={styles.row}>
        <label className={styles.label} htmlFor="harness-prompt">
          Prompt
        </label>
        <textarea
          id="harness-prompt"
          className={styles.prompt}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
          }}
        />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="harness-files">
          Images
        </label>
        <input
          id="harness-files"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          multiple
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []));
          }}
        />
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          disabled={running || !profile}
          onClick={() => void run()}
        >
          {running ? 'Running…' : 'Run'}
        </button>
        <button
          type="button"
          className={cx(styles.button, styles.secondary)}
          disabled={!running}
          onClick={() => handleRef.current?.abort()}
        >
          Abort
        </button>
      </div>

      <pre className={styles.output}>{output || '—'}</pre>

      {stats ? (
        <p className={styles.stats}>
          prefill {Math.round(stats.prefillMs)}ms · decode {Math.round(stats.decodeMs)}ms ·{' '}
          {stats.tokensPerSecond.toFixed(1)} tok/s · ~{stats.peakMemoryEstimateMB}MB
        </p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  );
}
