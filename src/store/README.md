# store

Dexie (IndexedDB) persistence and the sequential processing queue.

Holds documents, pages, edit audit trails, and settings. Source file bytes are
stored as blobs so all state survives reload with no network. The queue runs at
concurrency 1 (matching the worker invariant) and persists its state so a reload
resumes where it stopped.

_Populated in Phase 11._
