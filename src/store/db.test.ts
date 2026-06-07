import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createRepository, FaturlensDB, type DocumentRecord, type PageRecord } from './db.ts';
import { checkDuplicate } from './dedup.ts';

let dbCounter = 0;
function freshRepo() {
  dbCounter += 1;
  return createRepository(new FaturlensDB(`faturlens-test-${String(dbCounter)}`));
}

function doc(id: string, hash: string): DocumentRecord {
  return {
    id,
    fileName: `${id}.pdf`,
    fileHash: hash,
    pageCount: 1,
    createdAt: dbCounter,
    status: 'ready-for-review',
    fileBlob: new Blob(['x']),
  };
}
function page(id: string, documentId: string, pageIndex: number): PageRecord {
  return { id, documentId, pageIndex, imageBlob: new Blob(['p']) };
}

describe('repository CRUD', () => {
  it('adds and reads a document', async () => {
    const repo = freshRepo();
    await repo.addDocument(doc('d1', 'hashA'));
    expect((await repo.getDocument('d1'))?.fileName).toBe('d1.pdf');
  });

  it('lists pages for a document sorted by index', async () => {
    const repo = freshRepo();
    await repo.addPage(page('p2', 'd1', 1));
    await repo.addPage(page('p1', 'd1', 0));
    const pages = await repo.pagesForDocument('d1');
    expect(pages.map((p) => p.pageIndex)).toEqual([0, 1]);
  });
});

describe('dedup', () => {
  it('detects an existing document by content hash', async () => {
    const repo = freshRepo();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const first = await checkDuplicate(repo, bytes);
    expect(first.existing).toBeUndefined();
    await repo.addDocument(doc('d1', first.hash));
    const second = await checkDuplicate(repo, bytes);
    expect(second.existing?.id).toBe('d1');
  });
});

describe('cascade deletion', () => {
  it('removes pages and edits along with the document', async () => {
    const repo = freshRepo();
    await repo.addDocument(doc('d1', 'hashA'));
    await repo.addPage(page('p1', 'd1', 0));
    await repo.addEdit({ id: 'e1', pageId: 'p1', fieldPath: 'total', before: 1, after: 2, at: 1 });

    await repo.deleteDocumentCascade('d1');

    expect(await repo.getDocument('d1')).toBeUndefined();
    expect(await repo.pagesForDocument('d1')).toHaveLength(0);
    expect(await repo.editsForPage('p1')).toHaveLength(0);
  });
});

describe('settings', () => {
  it('round-trips a setting value', async () => {
    const repo = freshRepo();
    await repo.setSetting('tokensPerSecond', 7.5);
    expect(await repo.getSetting<number>('tokensPerSecond')).toBe(7.5);
  });
});
