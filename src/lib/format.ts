/** Human-readable byte size, e.g. 1536 → "1.5 KB", 2_130_132_992 → "2.0 GB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex] ?? 'KB'}`;
}

/** Format a fraction in [0, 1] as a whole-number percentage string. */
export function formatPercent(fraction: number): string {
  return `${String(Math.round(Math.max(0, Math.min(1, fraction)) * 100))}%`;
}
