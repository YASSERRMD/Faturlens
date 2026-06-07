import { describe, expect, it } from 'vitest';
import { suggestBudget, TOKEN_BUDGET_FULL, TOKEN_BUDGET_REDUCED } from './autotune.ts';

describe('suggestBudget', () => {
  it('suggests reducing when WebGPU decode is slow and budget is full', () => {
    const s = suggestBudget('webgpu', 2, TOKEN_BUDGET_FULL);
    expect(s.suggest).toBe(true);
    expect(s.proposed).toBe(TOKEN_BUDGET_REDUCED);
  });

  it('does not suggest when throughput is acceptable', () => {
    expect(suggestBudget('webgpu', 5, TOKEN_BUDGET_FULL).suggest).toBe(false);
  });

  it('does not suggest on WASM', () => {
    expect(suggestBudget('wasm', 1, TOKEN_BUDGET_FULL).suggest).toBe(false);
  });

  it('does not suggest when already at the reduced floor', () => {
    expect(suggestBudget('webgpu', 1, TOKEN_BUDGET_REDUCED).suggest).toBe(false);
  });
});
