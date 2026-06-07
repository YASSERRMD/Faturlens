// Pass 2 runner: build the prompt, infer, repair JSON, validate against the raw
// contract, and map to InvoiceV1. On a parse/validation failure, one corrective
// re-prompt that echoes the errors, then a typed terminal failure.

import { type z } from 'zod';
import type { InvoiceV1 } from '../../schema/invoice.ts';
import { mapRawToInvoice, rawInvoiceSchema, type RawInvoice } from '../../schema/json-types.ts';
import type { GenerationStats } from '../../worker/protocol.ts';
import { correctivePrompt, PASS2_PROMPT_V1, PASS2_PROMPT_VERSION } from './prompt.ts';
import { repairJson } from './repair.ts';

interface InferHandleLike extends AsyncIterable<string> {
  completed: Promise<{ fullText: string; stats: GenerationStats }>;
}

export interface Pass2Client {
  infer: (request: {
    images: ImageBitmap[];
    prompt: string;
    maxNewTokens?: number;
  }) => InferHandleLike;
}

export interface Pass2Input {
  images: ImageBitmap[];
  transcript: string;
}

export type Pass2Result =
  | {
      ok: true;
      invoice: InvoiceV1;
      raw: RawInvoice;
      promptVersion: string;
      retried: boolean;
    }
  | { ok: false; stage: 'repair' | 'validation'; message: string; retried: boolean };

export interface Pass2Options {
  maxNewTokens?: number;
}

async function infer(handle: InferHandleLike): Promise<string> {
  // Drain the stream; Pass 2 only needs the full text.
  for await (const token of handle) void token;
  return (await handle.completed).fullText;
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('\n');
}

/** Run Pass 2 extraction with a single corrective re-prompt on failure. */
export async function runPass2(
  input: Pass2Input,
  client: Pass2Client,
  options: Pass2Options = {},
): Promise<Pass2Result> {
  const maxNewTokens = options.maxNewTokens ?? 2048;
  const basePrompt = `${PASS2_PROMPT_V1}\n\n## Transcript\n${input.transcript}`;

  let prompt = basePrompt;
  let retried = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const text = await infer(client.infer({ images: input.images, prompt, maxNewTokens }));

    const repaired = repairJson(text);
    if (!repaired.ok) {
      if (attempt === 0) {
        retried = true;
        prompt = correctivePrompt(basePrompt, `Could not parse JSON: ${repaired.message}`);
        continue;
      }
      return { ok: false, stage: 'repair', message: repaired.message, retried };
    }

    const parsed = rawInvoiceSchema.safeParse(repaired.value);
    if (!parsed.success) {
      const message = formatZodError(parsed.error);
      if (attempt === 0) {
        retried = true;
        prompt = correctivePrompt(basePrompt, message);
        continue;
      }
      return { ok: false, stage: 'validation', message, retried };
    }

    return {
      ok: true,
      invoice: mapRawToInvoice(parsed.data),
      raw: parsed.data,
      promptVersion: PASS2_PROMPT_VERSION,
      retried,
    };
  }

  return {
    ok: false,
    stage: 'validation',
    message: 'Extraction attempts exhausted',
    retried: true,
  };
}
