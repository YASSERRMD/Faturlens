import { useDeviceProfile } from '../capability/useDeviceProfile.tsx';
import { cx } from '../lib/cx.ts';
import styles from './DeviceReport.module.css';

/**
 * Diagnostic card rendering the resolved {@link DeviceProfile}. Mounted behind
 * the `?diag` query param on the main page.
 */
export function DeviceReport(): React.JSX.Element {
  const { profile, loading, error } = useDeviceProfile();

  if (loading) return <p>Detecting device capabilities…</p>;
  if (error) return <p role="alert">Capability detection failed: {error}</p>;
  if (!profile) return <p role="alert">No device profile available.</p>;

  const adapterInfo = profile.webgpu.available ? profile.webgpu.info : undefined;
  const adapterLabel = adapterInfo
    ? [adapterInfo.vendor, adapterInfo.device].filter(Boolean).join(' ') || 'unknown'
    : '—';

  return (
    <section className={styles.card} aria-label="Device capability report">
      <div className={styles.header}>
        <h2 className={styles.title}>Device profile</h2>
        <span
          className={cx(
            styles.badge,
            profile.executionProvider === 'webgpu' ? styles.badgeWebgpu : styles.badgeWasm,
          )}
        >
          {profile.executionProvider}
        </span>
      </div>

      <dl className={styles.grid}>
        <dt className={styles.key}>Memory tier</dt>
        <dd className={styles.value}>{profile.memoryTier}</dd>

        <dt className={styles.key}>Device memory</dt>
        <dd className={styles.value}>
          {profile.memory.deviceMemoryGb !== undefined
            ? `${String(profile.memory.deviceMemoryGb)} GB`
            : 'unknown'}
        </dd>

        <dt className={styles.key}>Image token budget</dt>
        <dd className={styles.value}>{profile.imageTokenBudget} / tile</dd>

        <dt className={styles.key}>Max tiles / page</dt>
        <dd className={styles.value}>{profile.maxTilesPerPage}</dd>

        <dt className={styles.key}>Concurrency</dt>
        <dd className={styles.value}>{profile.concurrency}</dd>

        <dt className={styles.key}>GPU adapter</dt>
        <dd className={styles.value}>{adapterLabel}</dd>
      </dl>

      {profile.warnings.length > 0 ? (
        <ul className={styles.warnings}>
          {profile.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.clean}>No warnings — running on the fast path.</p>
      )}
    </section>
  );
}
