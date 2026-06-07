import { describe, expect, it } from 'vitest';
import {
  benchmarkToTps,
  estimateBatchSeconds,
  estimatePageSeconds,
  formatEstimate,
} from './estimate.ts';

describe('benchmarkToTps', () => {
  it('converts tokens over ms to tokens/second', () => {
    expect(benchmarkToTps(64, 8000)).toBe(8);
  });
  it('returns 0 for non-positive elapsed', () => {
    expect(benchmarkToTps(64, 0)).toBe(0);
  });
});

describe('estimatePageSeconds', () => {
  it('divides expected tokens by throughput', () => {
    expect(estimatePageSeconds(12, 1200)).toBe(100);
  });
  it('is Infinity at zero throughput', () => {
    expect(estimatePageSeconds(0)).toBe(Infinity);
  });
});

describe('estimateBatchSeconds', () => {
  it('scales by page count', () => {
    expect(estimateBatchSeconds(3, 12)).toBe(300);
  });
});

describe('formatEstimate', () => {
  it('shows seconds under 90s', () => {
    expect(formatEstimate(45)).toBe('~45s');
  });
  it('shows minutes for longer estimates', () => {
    expect(formatEstimate(180)).toBe('~3 min');
  });
  it('shows unknown for Infinity', () => {
    expect(formatEstimate(Infinity)).toBe('unknown');
  });
});
