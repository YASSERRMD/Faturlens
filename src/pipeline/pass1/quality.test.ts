import { describe, expect, it } from 'vitest';
import { assessTranscript } from './quality.ts';

const cleanInvoice = `# Invoice 2024-0042

| Item | Qty | Unit Price | Amount |
| --- | --- | --- | --- |
| Widget A | 2 | 50.00 | 100.00 |
| Widget B | 3 | 25.50 | 76.50 |

Subtotal: 176.50
VAT (5%): 8.83
Total: 185.33
TRN: 100123456700003`;

describe('assessTranscript', () => {
  it('rates a clean digit-rich invoice as ok', () => {
    const report = assessTranscript(cleanInvoice);
    expect(report.verdict).toBe('ok');
    expect(report.digitDensity).toBeGreaterThan(0.03);
    expect(report.tableLineRatio).toBeGreaterThan(0);
  });

  it('rates an empty transcript as failed', () => {
    const report = assessTranscript('   \n  ');
    expect(report.verdict).toBe('failed');
    expect(report.reasons).toContain('Transcript is empty');
  });

  it('rates a degenerate repetition loop as failed', () => {
    const phrase = Array.from({ length: 22 }, (_v, i) => `word${String(i)}`).join(' ');
    const looped = `${phrase} ${phrase} ${phrase} ${phrase}`;
    const report = assessTranscript(looped);
    expect(report.repetitionScore).toBeGreaterThanOrEqual(3);
    expect(report.verdict).toBe('failed');
  });

  it('rates prose with no digits as failed', () => {
    const prose =
      'This document contains only descriptive prose about the company history and mission statement with absolutely no numeric figures present anywhere in the body text.';
    const report = assessTranscript(prose);
    expect(report.digitDensity).toBe(0);
    expect(report.verdict).toBe('failed');
  });

  it('flags low digit density as suspect', () => {
    // Unique words (no shingle repeats), ~130 letters, 2 digits → density ~0.015,
    // which sits between the failed (0.01) and suspect (0.03) thresholds.
    const base =
      'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud';
    const report = assessTranscript(`${base} 55`);
    expect(report.digitDensity).toBeGreaterThanOrEqual(0.01);
    expect(report.digitDensity).toBeLessThan(0.03);
    expect(report.verdict).toBe('suspect');
  });
});
