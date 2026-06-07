// Lazy PDF rasterization with pdf.js. Each page renders only when requested,
// at a DPI chosen by `sizingForPage` so the longest edge lands near 1536px.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { sizingForPage } from './dpi.ts';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfDocumentHandle {
  pageCount: number;
  /** Rasterize a single page (0-based) to an upright ImageBitmap. */
  renderPage: (pageIndex: number) => Promise<ImageBitmap>;
  destroy: () => Promise<void>;
}

export async function loadPdf(data: ArrayBuffer): Promise<PdfDocumentHandle> {
  const doc = await pdfjs.getDocument({ data }).promise;

  const renderPage = async (pageIndex: number): Promise<ImageBitmap> => {
    const page = await doc.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const sizing = sizingForPage(base.width, base.height);
    const viewport = page.getViewport({ scale: sizing.scale });

    const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    page.cleanup();
    return createImageBitmap(canvas);
  };

  return {
    pageCount: doc.numPages,
    renderPage,
    destroy: () => doc.destroy(),
  };
}
