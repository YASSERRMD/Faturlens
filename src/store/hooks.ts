// liveQuery hooks for documents and the processing queue.

import { useLiveQuery } from 'dexie-react-hooks';
import { repository, type DocumentRecord } from './db.ts';

export function useDocuments(): DocumentRecord[] {
  return useLiveQuery(() => repository.allDocuments(), [], []);
}

export function useQueue(): DocumentRecord[] {
  return useLiveQuery(
    () => repository.db.documents.where('status').anyOf('queued', 'processing').toArray(),
    [],
    [],
  );
}
