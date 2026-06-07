import { describe, expect, it } from 'vitest';
import type { GenerationStats } from '../../worker/protocol.ts';
import { runPass1, type Pass1Client } from './run.ts';

const stats: GenerationStats = {
  prefillMs: 1,
  decodeMs: 1,
  tokensPerSecond: 1,
  peakMemoryEstimateMB: 1,
};

const bitmap = (): ImageBitmap => ({}) as ImageBitmap;

function handleOf(fullText: string) {
  return {
    completed: Promise.resolve({ fullText, stats }),
    [Symbol.asyncIterator](): AsyncIterator<string> {
      let done = false;
      return {
        next: (): Promise<IteratorResult<string>> => {
          if (done) return Promise.resolve({ value: undefined, done: true });
          done = true;
          return Promise.resolve({ value: fullText, done: false });
        },
      };
    },
  };
}

function scriptedClient(texts: string[]): Pass1Client & { calls: ImageBitmap[][] } {
  const calls: ImageBitmap[][] = [];
  let index = 0;
  return {
    calls,
    infer: (req) => {
      calls.push(req.images);
      const text = texts[index] ?? '';
      index += 1;
      return handleOf(text);
    },
  };
}

const goodMarkdown = '| A | 1 | 2.00 | 2.00 |\nTotal: 2.00 TRN 100000000000003';

describe('runPass1', () => {
  it('returns ok without retrying on a good transcript', async () => {
    const client = scriptedClient([goodMarkdown]);
    const result = await runPass1({ tiles: [bitmap()], thumbnail: bitmap() }, client);
    expect(result.quality.verdict).toBe('ok');
    expect(result.retried).toBe(false);
    expect(client.calls).toHaveLength(1);
    expect(result.promptVersion).toBe('PASS1_PROMPT_V1');
  });

  it('retries thumbnail-only when the first read fails', async () => {
    const client = scriptedClient(['', goodMarkdown]);
    const thumb = bitmap();
    const result = await runPass1({ tiles: [bitmap(), bitmap()], thumbnail: thumb }, client);
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1]).toEqual([thumb]); // retry uses thumbnail only
    expect(result.retried).toBe(true);
    expect(result.quality.verdict).toBe('ok');
  });

  it('does not retry when there is no thumbnail', async () => {
    const client = scriptedClient(['']);
    const result = await runPass1({ tiles: [bitmap()], thumbnail: null }, client);
    expect(client.calls).toHaveLength(1);
    expect(result.retried).toBe(false);
    expect(result.quality.verdict).toBe('failed');
  });

  it('retries at most once even if the retry also fails', async () => {
    const client = scriptedClient(['', '']);
    const result = await runPass1({ tiles: [bitmap()], thumbnail: bitmap() }, client);
    expect(client.calls).toHaveLength(2);
    expect(result.retried).toBe(true);
    expect(result.quality.verdict).toBe('failed');
  });
});
