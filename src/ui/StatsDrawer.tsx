import { useState } from 'react';
import { formatEstimate } from '../perf/estimate.ts';
import styles from './StatsDrawer.module.css';

export interface StageTiming {
  stage: string;
  ms: number;
}

export interface StatsDrawerProps {
  timings: StageTiming[];
  tokensPerSecond?: number;
  peakMemoryEstimateMB?: number;
}

/** Local-only timing telemetry. Nothing leaves the machine. */
export function StatsDrawer({
  timings,
  tokensPerSecond,
  peakMemoryEstimateMB,
}: StatsDrawerProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const total = timings.reduce((sum, t) => sum + t.ms, 0);

  return (
    <div className={styles.drawer}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => {
          setOpen((v) => !v);
        }}
        aria-expanded={open}
      >
        {open ? '▾' : '▸'} Stats ({formatEstimate(total / 1000)})
      </button>
      {open ? (
        <div className={styles.body}>
          {timings.map((t) => (
            <div className={styles.row} key={t.stage}>
              <span className={styles.key}>{t.stage}</span>
              <span>{Math.round(t.ms)} ms</span>
            </div>
          ))}
          {tokensPerSecond !== undefined ? (
            <div className={styles.row}>
              <span className={styles.key}>throughput</span>
              <span>{tokensPerSecond.toFixed(1)} tok/s</span>
            </div>
          ) : null}
          {peakMemoryEstimateMB !== undefined ? (
            <div className={styles.row}>
              <span className={styles.key}>peak memory (est.)</span>
              <span>~{peakMemoryEstimateMB} MB</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
