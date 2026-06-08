// Upload helpers: validate + ingest a file into a viewable image, and build a
// blank invoice for manual review when no extraction has run yet.

import { ingestFile } from '../pipeline/ingest/ingest.ts';
import type { Field, InvoiceV1, LineItem } from '../schema/invoice.ts';

function missing<T>(): Field<T> {
  return { value: null, confidence: 'missing' };
}

function emptyLine(): LineItem {
  return {
    description: missing<string>(),
    quantity: missing<number>(),
    unitPrice: missing<number>(),
    amount: missing<number>(),
  };
}

export function emptyInvoice(): InvoiceV1 {
  return {
    vendor: {
      name: missing<string>(),
      address: missing<string>(),
      trn: missing<string>(),
      phone: missing<string>(),
      email: missing<string>(),
    },
    invoiceNumber: missing<string>(),
    issueDate: missing<string>(),
    currency: missing<string>(),
    lineItems: [emptyLine()],
    subtotal: missing<number>(),
    taxAmount: missing<number>(),
    total: missing<number>(),
    uncertain: [],
  };
}

export function bitmapToDataUrl(bitmap: ImageBitmap): string {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return canvas.toDataURL('image/png');
}

export type UploadResult =
  | { ok: true; imageSrc: string; pageCount: number }
  | { ok: false; message: string };

/** Validate and ingest a file; return a viewable image of its first page. */
export async function uploadToImage(file: File): Promise<UploadResult> {
  const ingested = await ingestFile(file);
  if (!ingested.ok) return { ok: false, message: ingested.rejection.message };
  try {
    const page = await ingested.document.getPage(0);
    const imageSrc = bitmapToDataUrl(page);
    return { ok: true, imageSrc, pageCount: ingested.document.pageCount };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
