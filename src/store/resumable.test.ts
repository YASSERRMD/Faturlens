import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createRepository, FaturlensDB, type DocumentRecord } from './db.ts';
import { markInFlightResumable } from './resumable.ts';

function doc(id: string, status: DocumentRecord['status']): DocumentRecord {
  return {
    id,
    fileName: `${id}.pdf`,
    fileHash: id,
    pageCount: 1,
    createdAt: 1,
    status,
    fileBlob: new Blob(['x']),
  };
}

describe('markInFlightResumable', () => {
  it('resets processing documents to queued', async () => {
    const repo = createRepository(new FaturlensDB('faturlens-resumable-test'));
    await repo.addDocument(doc('a', 'processing'));
    await repo.addDocument(doc('b', 'ready-for-review'));

    const count = await markInFlightResumable(repo);
    expect(count).toBe(1);
    expect((await repo.getDocument('a'))?.status).toBe('queued');
    expect((await repo.getDocument('b'))?.status).toBe('ready-for-review');
  });
});
