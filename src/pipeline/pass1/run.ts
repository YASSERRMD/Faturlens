// Pass 1 runner: assemble tiles + thumbnail, stream a full markdown transcript,
// assess quality, and retry once (thumbnail-only) when the first read fails.

import type { GenerationStats } from '../../worker/protocol.ts';
import { PASS1_PROMPT_V1, PASS1_PROMPT_VERSION } from './prompt.ts';
import { assessTranscript, type QualityReport } from './quality.ts';

export interface Pass1Input {
  tiles: ImageBitmap[];
  thumbnail: ImageBitmap | null;
}

interface InferHandleLike extends AsyncIterable<string> {
  completed: Promise<{ fullText: string; stats: GenerationStats }>;
}

export interface Pass1Client {
  infer: (request: {
    images: ImageBitmap[];
    prompt: string;
    maxNewTokens?: number;
  }) => InferHandleLike;
}

export interface Pass1Options {
  onToken?: (text: string) => void;
  maxNewTokens?: number;
}

export interface Pass1Result {
  markdown: string;
  stats: GenerationStats;
  quality: QualityReport;
  promptVersion: string;
  retried: boolean;
}

async function consume(
  handle: InferHandleLike,
  onToken?: (text: string) => void,
): Promise<{ markdown: string; stats: GenerationStats }> {
  for await (const token of handle) onToken?.(token);
  const result = await handle.completed;
  return { markdown: result.fullText, stats: result.stats };
}

/** Run Pass 1 transcription with a single thumbnail-only retry on failure. */
export async function runPass1(
  input: Pass1Input,
  client: Pass1Client,
  options: Pass1Options = {},
): Promise<Pass1Result> {
  const maxNewTokens = options.maxNewTokens ?? 2048;
  const primaryImages = input.thumbnail ? [...input.tiles, input.thumbnail] : input.tiles;

  let { markdown, stats } = await consume(
    client.infer({ images: primaryImages, prompt: PASS1_PROMPT_V1, maxNewTokens }),
    options.onToken,
  );
  let quality = assessTranscript(markdown);
  let retried = false;

  // Sometimes global context (thumbnail only) succeeds where tiles confuse the
  // model. Exactly one retry, only when the first attempt failed.
  if (quality.verdict === 'failed' && input.thumbnail) {
    retried = true;
    const retry = await consume(
      client.infer({ images: [input.thumbnail], prompt: PASS1_PROMPT_V1, maxNewTokens }),
      options.onToken,
    );
    markdown = retry.markdown;
    stats = retry.stats;
    quality = assessTranscript(markdown);
  }

  return { markdown, stats, quality, promptVersion: PASS1_PROMPT_VERSION, retried };
}
