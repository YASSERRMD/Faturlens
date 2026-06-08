// End-to-end "read this invoice" controller: ingest → load model → extract →
// map to InvoiceV1. The full page image is passed to the worker, whose
// Transformers.js processor does the tiling/patch preprocessing internally.

import type { DeviceProfile } from '../capability/profile.ts';
import { ingestFile } from '../pipeline/ingest/ingest.ts';
import { runPass2 } from '../pipeline/pass2/run.ts';
import type { InvoiceV1 } from '../schema/invoice.ts';
import { createInferenceClient, type InferenceClient } from '../worker/client.ts';
import { bitmapToDataUrl, emptyInvoice } from './upload.ts';

export type ProcessStage = 'ingesting' | 'loading-model' | 'extracting' | 'done';

export interface ProcessResult {
  invoice: InvoiceV1;
  imageSrc: string;
  rawText: string;
  extracted: boolean;
}

export interface ProcessCallbacks {
  onStage: (stage: ProcessStage) => void;
  onLoadProgress?: (fraction: number) => void;
  onToken?: (chunk: string) => void;
}

let sharedClient: InferenceClient | null = null;

/** Validate + ingest + extract a single uploaded invoice. */
export async function processInvoice(
  file: File,
  profile: DeviceProfile,
  cb: ProcessCallbacks,
): Promise<ProcessResult> {
  cb.onStage('ingesting');
  const ingested = await ingestFile(file);
  if (!ingested.ok) throw new Error(ingested.rejection.message);

  const page = await ingested.document.getPage(0);
  const imageSrc = bitmapToDataUrl(page);

  const client = (sharedClient ??= createInferenceClient());
  client.onLoadProgress = (_stage, fraction) => cb.onLoadProgress?.(fraction);

  cb.onStage('loading-model');
  await client.load(profile);

  cb.onStage('extracting');
  let rawText = '';
  const pass2 = await runPass2({ images: [page], transcript: '' }, client, { maxNewTokens: 2048 });

  // runPass2 drains tokens internally; if it failed, fall back to a blank form
  // so the user still lands in the review UI with the page image.
  cb.onStage('done');
  if (pass2.ok) {
    return { invoice: pass2.invoice, imageSrc, rawText, extracted: true };
  }
  rawText = pass2.message;
  return { invoice: emptyInvoice(), imageSrc, rawText, extracted: false };
}
