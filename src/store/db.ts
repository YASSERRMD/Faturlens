// Dexie (IndexedDB) schema v1 and repositories. Source bytes are stored as
// blobs so all state survives reload with no network.

import Dexie, { type Table } from 'dexie';

export type DocumentStatus = 'queued' | 'processing' | 'ready-for-review' | 'approved' | 'failed';

export interface DocumentRecord {
  id: string;
  fileName: string;
  fileHash: string;
  pageCount: number;
  createdAt: number;
  status: DocumentStatus;
  fileBlob: Blob;
}

export interface PageRecord {
  id: string;
  documentId: string;
  pageIndex: number;
  imageBlob: Blob;
  transcript?: string;
  transcriptQuality?: unknown;
  extraction?: unknown;
  findings?: unknown;
  reviewState?: unknown;
}

export interface EditRecord {
  id: string;
  pageId: string;
  fieldPath: string;
  before: string | number | null;
  after: string | number | null;
  at: number;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export class FaturlensDB extends Dexie {
  documents!: Table<DocumentRecord, string>;
  pages!: Table<PageRecord, string>;
  edits!: Table<EditRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor(name = 'faturlens') {
    super(name);
    this.version(1).stores({
      documents: 'id, fileHash, status, createdAt',
      pages: 'id, documentId, [documentId+pageIndex]',
      edits: 'id, pageId',
      settings: 'key',
    });
  }
}

export interface Repository {
  db: FaturlensDB;
  addDocument: (doc: DocumentRecord) => Promise<void>;
  getDocument: (id: string) => Promise<DocumentRecord | undefined>;
  findByHash: (hash: string) => Promise<DocumentRecord | undefined>;
  allDocuments: () => Promise<DocumentRecord[]>;
  setDocumentStatus: (id: string, status: DocumentStatus) => Promise<void>;
  addPage: (page: PageRecord) => Promise<void>;
  pagesForDocument: (documentId: string) => Promise<PageRecord[]>;
  addEdit: (edit: EditRecord) => Promise<void>;
  editsForPage: (pageId: string) => Promise<EditRecord[]>;
  deleteDocumentCascade: (documentId: string) => Promise<void>;
  getSetting: <T>(key: string) => Promise<T | undefined>;
  setSetting: (key: string, value: unknown) => Promise<void>;
}

export function createRepository(database: FaturlensDB): Repository {
  return {
    db: database,
    addDocument: async (doc) => {
      await database.documents.put(doc);
    },
    getDocument: (id) => database.documents.get(id),
    findByHash: (hash) => database.documents.where('fileHash').equals(hash).first(),
    allDocuments: () => database.documents.orderBy('createdAt').toArray(),
    setDocumentStatus: async (id, status) => {
      await database.documents.update(id, { status });
    },
    addPage: async (page) => {
      await database.pages.put(page);
    },
    pagesForDocument: (documentId) =>
      database.pages.where('documentId').equals(documentId).sortBy('pageIndex'),
    addEdit: async (edit) => {
      await database.edits.put(edit);
    },
    editsForPage: (pageId) => database.edits.where('pageId').equals(pageId).toArray(),
    deleteDocumentCascade: async (documentId) => {
      await database.transaction(
        'rw',
        database.documents,
        database.pages,
        database.edits,
        async () => {
          const pages = await database.pages.where('documentId').equals(documentId).toArray();
          const pageIds = pages.map((p) => p.id);
          await database.edits.where('pageId').anyOf(pageIds).delete();
          await database.pages.where('documentId').equals(documentId).delete();
          await database.documents.delete(documentId);
        },
      );
    },
    getSetting: async <T>(key: string): Promise<T | undefined> => {
      const record = await database.settings.get(key);
      return record?.value as T | undefined;
    },
    setSetting: async (key, value) => {
      await database.settings.put({ key, value });
    },
  };
}

/** The application-wide repository (default IndexedDB database). */
export const repository: Repository = createRepository(new FaturlensDB());
