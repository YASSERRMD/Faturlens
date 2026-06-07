// Input acceptance with typed rejection reasons. Pure predicate logic so it is
// fully unit-testable without real files.

export const ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PDF_PAGES = 20;

export type RejectionReason = 'unsupported-type' | 'file-too-large' | 'too-many-pages';

export type AcceptResult =
  | { ok: true; mimeType: AcceptedMimeType }
  | { ok: false; reason: RejectionReason; message: string };

export interface FileMeta {
  type: string;
  size: number;
}

function isAcceptedMime(type: string): type is AcceptedMimeType {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(type);
}

/** Validate a file's MIME type and size before any decoding. */
export function acceptFile(meta: FileMeta): AcceptResult {
  if (!isAcceptedMime(meta.type)) {
    return {
      ok: false,
      reason: 'unsupported-type',
      message: `Unsupported file type "${meta.type || 'unknown'}". Accepted: PNG, JPEG, WebP, PDF.`,
    };
  }
  if (meta.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      reason: 'file-too-large',
      message: `File is ${formatMb(meta.size)} MB; the limit is ${formatMb(MAX_FILE_BYTES)} MB.`,
    };
  }
  return { ok: true, mimeType: meta.type };
}

/** Validate a parsed PDF's page count. */
export function acceptPdfPageCount(pageCount: number): AcceptResult {
  if (pageCount > MAX_PDF_PAGES) {
    return {
      ok: false,
      reason: 'too-many-pages',
      message: `PDF has ${String(pageCount)} pages; the limit is ${String(MAX_PDF_PAGES)}.`,
    };
  }
  return { ok: true, mimeType: 'application/pdf' };
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
