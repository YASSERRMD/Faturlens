import { describe, expect, it } from 'vitest';
import { acceptFile, acceptPdfPageCount, MAX_FILE_BYTES } from './accept.ts';

describe('acceptFile', () => {
  it('accepts supported image and pdf types', () => {
    expect(acceptFile({ type: 'image/png', size: 1000 }).ok).toBe(true);
    expect(acceptFile({ type: 'image/jpeg', size: 1000 }).ok).toBe(true);
    expect(acceptFile({ type: 'image/webp', size: 1000 }).ok).toBe(true);
    expect(acceptFile({ type: 'application/pdf', size: 1000 }).ok).toBe(true);
  });

  it('rejects unsupported types with a typed reason', () => {
    const result = acceptFile({ type: 'image/gif', size: 1000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported-type');
  });

  it('rejects empty mime type', () => {
    const result = acceptFile({ type: '', size: 10 });
    expect(result.ok).toBe(false);
  });

  it('rejects files over the size limit', () => {
    const result = acceptFile({ type: 'image/png', size: MAX_FILE_BYTES + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('file-too-large');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(acceptFile({ type: 'image/png', size: MAX_FILE_BYTES }).ok).toBe(true);
  });
});

describe('acceptPdfPageCount', () => {
  it('accepts up to 20 pages', () => {
    expect(acceptPdfPageCount(20).ok).toBe(true);
  });

  it('rejects more than 20 pages with a typed reason', () => {
    const result = acceptPdfPageCount(21);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('too-many-pages');
  });
});
