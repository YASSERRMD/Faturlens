// Upload de-duplication by content hash.

import { sha256Hex } from '../lib/hash.ts';
import type { DocumentRecord, Repository } from './db.ts';

export interface DedupResult {
  hash: string;
  existing: DocumentRecord | undefined;
}

/** Hash bytes and look for an existing document with the same content. */
export async function checkDuplicate(
  repo: Repository,
  bytes: ArrayBuffer | Uint8Array,
): Promise<DedupResult> {
  const hash = await sha256Hex(bytes);
  const existing = await repo.findByHash(hash);
  return { hash, existing };
}
