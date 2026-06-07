// Ingestion orchestrator: acceptance → decode → lazy per-page bitmaps → tiling.
// Ties the browser-side pieces (pdf, orientation, preprocess) behind one API.

import { acceptFile, acceptPdfPageCount, type AcceptResult } from './accept.ts';
import { decodeUpright } from './orientation.ts';
import { loadPdf, type PdfDocumentHandle } from './pdf.ts';
import { extractTiles, type PreprocessResult } from './preprocess.ts';

export interface IngestedDocument {
  kind: 'image' | 'pdf';
  pageCount: number;
  /** Rasterize a page (0-based) to an upright bitmap. */
  getPage: (pageIndex: number) => Promise<ImageBitmap>;
  destroy: () => Promise<void>;
}

export type IngestResult =
  | { ok: true; document: IngestedDocument }
  | { ok: false; rejection: Extract<AcceptResult, { ok: false }> };

/** Validate and open a file as a lazy multi-page document. */
export async function ingestFile(file: File): Promise<IngestResult> {
  const accepted = acceptFile({ type: file.type, size: file.size });
  if (!accepted.ok) return { ok: false, rejection: accepted };

  if (accepted.mimeType === 'application/pdf') {
    const data = await file.arrayBuffer();
    const pdf: PdfDocumentHandle = await loadPdf(data);
    const pageCheck = acceptPdfPageCount(pdf.pageCount);
    if (!pageCheck.ok) {
      await pdf.destroy();
      return { ok: false, rejection: pageCheck };
    }
    return {
      ok: true,
      document: {
        kind: 'pdf',
        pageCount: pdf.pageCount,
        getPage: (pageIndex) => pdf.renderPage(pageIndex),
        destroy: () => pdf.destroy(),
      },
    };
  }

  // Single-page image: decode lazily and cache the bitmap.
  let cached: ImageBitmap | null = null;
  return {
    ok: true,
    document: {
      kind: 'image',
      pageCount: 1,
      getPage: async () => {
        cached ??= await decodeUpright(file);
        return cached;
      },
      destroy: () => {
        cached?.close();
        cached = null;
        return Promise.resolve();
      },
    },
  };
}

/** Tile a single page bitmap for the active device budget. */
export function preprocessPage(page: ImageBitmap, maxTiles: number): Promise<PreprocessResult> {
  return extractTiles(page, maxTiles);
}
