import { describe, expect, it } from 'vitest';
import {
  createQueueItem,
  isTerminal,
  nextStage,
  queueReducer,
  resumeStage,
  type QueueItem,
} from './queue.ts';

const start = (): QueueItem => createQueueItem('q1', 'doc1');

describe('nextStage', () => {
  it('advances through the ordered stages', () => {
    expect(nextStage('queued')).toBe('preprocessing');
    expect(nextStage('pass1')).toBe('pass2');
    expect(nextStage('validating')).toBe('ready-for-review');
  });
  it('stays put at the terminal stage', () => {
    expect(nextStage('ready-for-review')).toBe('ready-for-review');
  });
});

describe('queueReducer — advance', () => {
  it('records the completed stage as it advances', () => {
    let item = start();
    item = queueReducer(item, { type: 'advance' }); // → preprocessing
    expect(item.stage).toBe('preprocessing');
    expect(item.lastCompletedStage).toBe('queued');
    item = queueReducer(item, { type: 'advance' }); // → pass1
    expect(item.stage).toBe('pass1');
    expect(item.lastCompletedStage).toBe('preprocessing');
  });

  it('does not advance past ready-for-review', () => {
    let item: QueueItem = { ...start(), stage: 'ready-for-review' };
    item = queueReducer(item, { type: 'advance' });
    expect(item.stage).toBe('ready-for-review');
    expect(isTerminal(item.stage)).toBe(true);
  });
});

describe('queueReducer — failure and retry', () => {
  it('fails with an error message while preserving resume point', () => {
    let item = start();
    item = queueReducer(item, { type: 'advance' }); // preprocessing, completed queued
    item = queueReducer(item, { type: 'advance' }); // pass1, completed preprocessing
    item = queueReducer(item, { type: 'fail', error: 'OOM' });
    expect(item.stage).toBe('failed');
    expect(item.error).toBe('OOM');
    expect(item.lastCompletedStage).toBe('preprocessing');
  });

  it('retries from the stage after the last completed one', () => {
    let item: QueueItem = {
      ...start(),
      stage: 'failed',
      lastCompletedStage: 'preprocessing',
      error: 'OOM',
    };
    item = queueReducer(item, { type: 'retry' });
    expect(item.stage).toBe('pass1');
    expect(item.error).toBeNull();
  });

  it('ignores retry when not failed', () => {
    const item = queueReducer(start(), { type: 'retry' });
    expect(item.stage).toBe('queued');
  });
});

describe('resumeStage (reload resume)', () => {
  it('restarts in-flight items from preprocessing when nothing completed', () => {
    expect(resumeStage(start())).toBe('preprocessing');
  });
  it('resumes from the stage after the last completed one', () => {
    expect(resumeStage({ ...start(), lastCompletedStage: 'pass1' })).toBe('pass2');
  });
});

describe('queueReducer — pause/resume', () => {
  it('toggles the paused flag', () => {
    let item = queueReducer(start(), { type: 'pause' });
    expect(item.paused).toBe(true);
    item = queueReducer(item, { type: 'resume' });
    expect(item.paused).toBe(false);
  });
});
