// Token-budget auto-tune. Pure decisions; the user confirms before any change
// is stored in settings.

import {
  TOKEN_BUDGET_FULL,
  TOKEN_BUDGET_REDUCED,
  type ExecutionProvider,
} from '../capability/profile.ts';

/** Below this decode throughput on WebGPU, suggest a smaller image token budget. */
export const MIN_ACCEPTABLE_TPS = 3;

export interface BudgetSuggestion {
  suggest: boolean;
  current: number;
  proposed: number;
  reason: string;
}

/**
 * Suggest reducing the image token budget when WebGPU decode throughput is too
 * low and the budget is not already at the floor.
 */
export function suggestBudget(
  provider: ExecutionProvider,
  tokensPerSecond: number,
  currentBudget: number,
): BudgetSuggestion {
  const noChange: BudgetSuggestion = {
    suggest: false,
    current: currentBudget,
    proposed: currentBudget,
    reason: '',
  };

  if (provider !== 'webgpu') return noChange;
  if (tokensPerSecond >= MIN_ACCEPTABLE_TPS) return noChange;
  if (currentBudget <= TOKEN_BUDGET_REDUCED) return noChange;

  return {
    suggest: true,
    current: currentBudget,
    proposed: TOKEN_BUDGET_REDUCED,
    reason: `Decode is ${tokensPerSecond.toFixed(1)} tok/s (< ${String(MIN_ACCEPTABLE_TPS)}); a smaller image budget will speed things up`,
  };
}

export { TOKEN_BUDGET_FULL, TOKEN_BUDGET_REDUCED };
