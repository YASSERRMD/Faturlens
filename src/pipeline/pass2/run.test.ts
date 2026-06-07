import { describe, expect, it } from 'vitest';
import type { GenerationStats } from '../../worker/protocol.ts';
import { runPass2, type Pass2Client } from './run.ts';

const stats: GenerationStats = {
  prefillMs: 1,
  decodeMs: 1,
  tokensPerSecond: 1,
  peakMemoryEstimateMB: 1,
};

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

function scriptedClient(texts: string[]): Pass2Client & { prompts: string[] } {
  const prompts: string[] = [];
  let index = 0;
  return {
    prompts,
    infer: (req) => {
      prompts.push(req.prompt);
      const text = texts[index] ?? '';
      index += 1;
      return handleOf(text);
    },
  };
}

const validJson =
  '{"vendor":{"name":"V"},"invoiceNumber":"1","issueDate":"2026-01-01","currency":"AED","lineItems":[],"subtotal":0,"taxAmount":0,"total":0}';

describe('runPass2', () => {
  it('extracts on the first valid response', async () => {
    const client = scriptedClient([validJson]);
    const result = await runPass2({ images: [], transcript: 't' }, client);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.retried).toBe(false);
      expect(result.invoice.vendor.name.value).toBe('V');
      expect(result.promptVersion).toBe('PASS2_PROMPT_V1');
    }
    expect(client.prompts).toHaveLength(1);
  });

  it('issues one corrective re-prompt after an unparseable response', async () => {
    const client = scriptedClient(['not json at all', validJson]);
    const result = await runPass2({ images: [], transcript: 't' }, client);
    expect(result.ok).toBe(true);
    expect(client.prompts).toHaveLength(2);
    expect(client.prompts[1]).toContain('previous output was invalid');
  });

  it('re-prompts on a schema validation failure', async () => {
    const client = scriptedClient(['{"lineItems": "not-an-array"}', validJson]);
    const result = await runPass2({ images: [], transcript: 't' }, client);
    expect(result.ok).toBe(true);
    expect(client.prompts).toHaveLength(2);
  });

  it('gives up with a typed repair failure after two bad responses', async () => {
    const client = scriptedClient(['garbage', 'still garbage']);
    const result = await runPass2({ images: [], transcript: 't' }, client);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stage).toBe('repair');
      expect(result.retried).toBe(true);
    }
    expect(client.prompts).toHaveLength(2);
  });

  it('gives up with a typed validation failure when both responses fail the schema', async () => {
    const client = scriptedClient(['{"lineItems": 5}', '{"lineItems": 7}']);
    const result = await runPass2({ images: [], transcript: 't' }, client);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.stage).toBe('validation');
  });
});
