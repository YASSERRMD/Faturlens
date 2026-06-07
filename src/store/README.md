# store

Dexie (IndexedDB) persistence and the sequential processing queue.

## Schema (v1)

- `documents` — `{ id, fileName, fileHash, pageCount, createdAt, status, fileBlob }`
- `pages` — `{ id, documentId, pageIndex, imageBlob, transcript, transcriptQuality, extraction, findings, reviewState }`
- `edits` — `{ id, pageId, fieldPath, before, after, at }`
- `settings` — `{ key, value }`

Source bytes are stored as blobs so all state survives reload with **no network
and no reprocessing**. `createRepository(db)` wraps a `FaturlensDB` instance;
`repository` is the app-wide default. Tests use `fake-indexeddb` with a fresh
named DB per case.

## Queue

`queue.ts` is a **pure** state machine (concurrency 1, matching the worker
invariant): `queued → preprocessing → pass1 → pass2 → validating →
ready-for-review`, plus `failed`. It tracks `lastCompletedStage` so a reload or
retry resumes the in-flight item from the stage **after** the last completed one
(`resumeStage`). Pause/resume toggle a flag.

## Dedup & storage

- `dedup.ts` — `checkDuplicate()` hashes bytes (sha256) and looks for an existing
  document, so a re-upload offers "open existing" instead of reprocessing.
- `storage.ts` — `estimateStorage()` via `navigator.storage.estimate()`, warning
  at 80%.
- `deleteDocumentCascade()` removes a document with its pages and edits in one
  transaction.

## Migration policy

Bump `this.version(N).stores(...)` with an upgrade function for any schema
change; never mutate the v1 store definition in place.
