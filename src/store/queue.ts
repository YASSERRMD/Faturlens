// Sequential processing queue state machine. Concurrency 1 (matching the worker
// invariant). Pure transitions so they are unit-tested; persistence and the
// actual stage work live elsewhere.

export type Stage =
  | 'queued'
  | 'preprocessing'
  | 'pass1'
  | 'pass2'
  | 'validating'
  | 'ready-for-review'
  | 'failed';

/** Ordered processing stages (excludes the terminal "failed"). */
export const STAGE_ORDER: readonly Stage[] = [
  'queued',
  'preprocessing',
  'pass1',
  'pass2',
  'validating',
  'ready-for-review',
];

export interface QueueItem {
  id: string;
  documentId: string;
  stage: Stage;
  /** Last stage that completed successfully (for reload/retry resume). */
  lastCompletedStage: Stage | null;
  paused: boolean;
  error: string | null;
}

export type QueueAction =
  | { type: 'advance' }
  | { type: 'fail'; error: string }
  | { type: 'retry' }
  | { type: 'pause' }
  | { type: 'resume' };

export function createQueueItem(id: string, documentId: string): QueueItem {
  return { id, documentId, stage: 'queued', lastCompletedStage: null, paused: false, error: null };
}

export function nextStage(stage: Stage): Stage {
  const index = STAGE_ORDER.indexOf(stage);
  if (index === -1 || index === STAGE_ORDER.length - 1) return stage;
  return STAGE_ORDER[index + 1] ?? stage;
}

export function isTerminal(stage: Stage): boolean {
  return stage === 'ready-for-review' || stage === 'failed';
}

/**
 * The stage a paused/reloaded/failed item should re-run from: the one after the
 * last completed stage (or the first stage if none completed).
 */
export function resumeStage(item: QueueItem): Stage {
  if (item.lastCompletedStage === null) return 'preprocessing';
  return nextStage(item.lastCompletedStage);
}

export function queueReducer(item: QueueItem, action: QueueAction): QueueItem {
  switch (action.type) {
    case 'advance': {
      if (isTerminal(item.stage)) return item;
      const completed = item.stage;
      return { ...item, stage: nextStage(item.stage), lastCompletedStage: completed, error: null };
    }
    case 'fail':
      return { ...item, stage: 'failed', error: action.error };
    case 'retry':
      if (item.stage !== 'failed') return item;
      return { ...item, stage: resumeStage(item), error: null };
    case 'pause':
      return { ...item, paused: true };
    case 'resume':
      return { ...item, paused: false };
    default:
      return item;
  }
}
