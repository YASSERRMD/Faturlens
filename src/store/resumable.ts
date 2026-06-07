// Mark in-flight work resumable so an abrupt tab close never corrupts the queue:
// any document left "processing" is reset to "queued" for a clean resume.

import { repository, type Repository } from './db.ts';

export async function markInFlightResumable(repo: Repository = repository): Promise<number> {
  const processing = await repo.db.documents.where('status').equals('processing').toArray();
  await Promise.all(processing.map((doc) => repo.setDocumentStatus(doc.id, 'queued')));
  return processing.length;
}

/** Register a beforeunload handler that flags in-flight work resumable. */
export function registerResumableOnUnload(repo: Repository = repository): () => void {
  const handler = (): void => {
    void markInFlightResumable(repo);
  };
  globalThis.addEventListener('beforeunload', handler);
  return () => {
    globalThis.removeEventListener('beforeunload', handler);
  };
}
