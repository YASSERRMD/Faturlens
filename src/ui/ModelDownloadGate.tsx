import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx.ts';
import { formatBytes, formatPercent } from '../lib/format.ts';
import {
  ensureModel,
  requestPersistentStorage,
  type ModelLoadProgress,
} from '../worker/loader/loader.ts';
import { totalManifestBytes } from '../worker/loader/manifest.ts';
import styles from './ModelDownloadGate.module.css';

type GateStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Blocks its children until the model is fully cached and verified. Shows
 * overall + per-file progress, a resume notice after an interruption, and a
 * warning when persistent storage was not granted.
 */
export function ModelDownloadGate({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<GateStatus>('idle');
  const [progress, setProgress] = useState<ModelLoadProgress | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setError(null);

    void requestPersistentStorage().then(setPersistent);

    ensureModel({ signal: controller.signal, onProgress: setProgress })
      .then(() => {
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    start();
    return () => abortRef.current?.abort();
  }, [start]);

  if (status === 'ready') return <>{children}</>;

  const total = totalManifestBytes();
  const overallFraction = progress?.overallFraction ?? 0;

  return (
    <section className={styles.gate} aria-label="Model download" aria-busy={status === 'loading'}>
      <h2 className={styles.heading}>Preparing the model</h2>
      <p className={styles.sub}>
        Faturlens runs entirely on your device. The model ({formatBytes(total)}) downloads once and
        is cached offline.
      </p>

      <div className={styles.overall}>
        <div className={styles.overallMeta}>
          <span>{progress?.stage === 'checking' ? 'Verifying cache…' : 'Downloading'}</span>
          <span>{formatPercent(overallFraction)}</span>
        </div>
        <div className={styles.bar}>
          <div
            className={styles.barFill}
            style={{ width: formatPercent(overallFraction) }}
            role="progressbar"
            aria-valuenow={Math.round(overallFraction * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {progress?.file ? (
          <p className={styles.file}>
            {progress.file} — {formatBytes(progress.fileReceived)} /{' '}
            {formatBytes(progress.fileTotal)}
          </p>
        ) : null}
      </div>

      {progress?.resumed ? (
        <p className={cx(styles.notice, styles.resume)}>
          Connection interrupted — resuming the download where it left off.
        </p>
      ) : null}

      {persistent === false ? (
        <p className={cx(styles.notice, styles.warning)}>
          Storage is not persistent; the browser may evict the cached model under memory pressure.
        </p>
      ) : null}

      {status === 'error' ? (
        <>
          <p className={cx(styles.notice, styles.error)}>Download failed: {error}</p>
          <button type="button" className={styles.retry} onClick={start}>
            Retry
          </button>
        </>
      ) : null}
    </section>
  );
}
