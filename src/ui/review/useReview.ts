import { useCallback, useMemo, useReducer } from 'react';
import type { InvoiceV1 } from '../../schema/invoice.ts';
import type { RuleContext } from '../../schema/rules/index.ts';
import { initReviewState, reviewReducer, type ReviewAction, type ReviewState } from './state.ts';

export interface UseReview {
  state: ReviewState;
  dispatch: (action: ReviewAction) => void;
}

export function useReview(invoice: InvoiceV1, ctx?: RuleContext): UseReview {
  const context = useMemo<RuleContext>(() => ctx ?? { today: new Date() }, [ctx]);
  const [state, rawDispatch] = useReducer(
    (s: ReviewState, a: ReviewAction) => reviewReducer(s, a, context),
    invoice,
    (init) => initReviewState(init, context),
  );
  const dispatch = useCallback((action: ReviewAction) => {
    rawDispatch(action);
  }, []);
  return { state, dispatch };
}
