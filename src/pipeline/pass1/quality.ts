// Deterministic, ML-free quality signals for a Pass 1 transcript. Invoices are
// digit-heavy and tabular; near-zero digits or a degenerate repetition loop is a
// strong signal that the read failed.

export interface QualitySignals {
  charCount: number;
  lineCount: number;
  tableLineRatio: number;
  digitDensity: number;
  unclearCount: number;
  /** Highest occurrence count of any 20-word shingle (≥3 ⇒ degenerate loop). */
  repetitionScore: number;
}

export type QualityVerdict = 'ok' | 'suspect' | 'failed';

export interface QualityReport extends QualitySignals {
  verdict: QualityVerdict;
  reasons: string[];
}

const SHINGLE_SIZE = 20;
const REPETITION_LIMIT = 3;
const FAILED_DIGIT_DENSITY = 0.01;
const SUSPECT_DIGIT_DENSITY = 0.03;
const SUSPECT_UNCLEAR_COUNT = 10;

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

function maxShingleRepetition(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < SHINGLE_SIZE) return 0;
  const counts = new Map<string, number>();
  let max = 0;
  for (let i = 0; i + SHINGLE_SIZE <= words.length; i += 1) {
    const shingle = words.slice(i, i + SHINGLE_SIZE).join(' ');
    const next = (counts.get(shingle) ?? 0) + 1;
    counts.set(shingle, next);
    if (next > max) max = next;
  }
  return max;
}

export function computeSignals(markdown: string): QualitySignals {
  const charCount = markdown.length;
  const lines = markdown.split('\n');
  const lineCount = lines.length;
  const tableLines = lines.filter((line) => line.includes('|')).length;
  const nonWhitespace = markdown.replace(/\s/g, '').length;
  const digits = countMatches(markdown, /\d/g);
  const unclearCount = countMatches(markdown, /\[unclear\]/gi);

  return {
    charCount,
    lineCount,
    tableLineRatio: lineCount > 0 ? tableLines / lineCount : 0,
    digitDensity: nonWhitespace > 0 ? digits / nonWhitespace : 0,
    unclearCount,
    repetitionScore: maxShingleRepetition(markdown),
  };
}

/** Assess a transcript and return signals plus a verdict with reasons. */
export function assessTranscript(markdown: string): QualityReport {
  const signals = computeSignals(markdown);
  const reasons: string[] = [];
  let verdict: QualityVerdict = 'ok';

  if (markdown.trim().length === 0) {
    return { ...signals, verdict: 'failed', reasons: ['Transcript is empty'] };
  }

  if (signals.repetitionScore >= REPETITION_LIMIT) {
    verdict = 'failed';
    reasons.push('Degenerate repetition loop detected');
  }

  if (signals.charCount > 50 && signals.digitDensity < FAILED_DIGIT_DENSITY) {
    verdict = 'failed';
    reasons.push('Almost no digits in a digit-heavy document; likely a failed read');
  } else if (signals.digitDensity < SUSPECT_DIGIT_DENSITY) {
    if (verdict === 'ok') verdict = 'suspect';
    reasons.push('Low digit density');
  }

  if (signals.unclearCount >= SUSPECT_UNCLEAR_COUNT) {
    if (verdict === 'ok') verdict = 'suspect';
    reasons.push(`${String(signals.unclearCount)} illegible regions`);
  }

  return { ...signals, verdict, reasons };
}
