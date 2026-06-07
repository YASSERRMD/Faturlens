import { cx } from '../lib/cx.ts';
import { repository, type DocumentRecord, type DocumentStatus } from '../store/db.ts';
import { useDocuments } from '../store/hooks.ts';
import styles from './DocumentList.module.css';

const chipClass: Record<DocumentStatus, string> = {
  queued: styles.queued ?? '',
  processing: styles.processing ?? '',
  'ready-for-review': styles['ready-for-review'] ?? '',
  approved: styles.approved ?? '',
  failed: styles.failed ?? '',
};

export interface DocumentListProps {
  onOpen?: (doc: DocumentRecord) => void;
}

/** Document list with status chips, retry on failure, and confirmed deletion. */
export function DocumentList({ onOpen }: DocumentListProps): React.JSX.Element {
  const documents = useDocuments();

  const remove = (doc: DocumentRecord): void => {
    if (!confirm(`Delete "${doc.fileName}" and all its pages and edits?`)) return;
    void repository.deleteDocumentCascade(doc.id);
  };
  const retry = (doc: DocumentRecord): void => {
    void repository.setDocumentStatus(doc.id, 'queued');
  };

  if (documents.length === 0) {
    return <p className={styles.empty}>No documents yet. Upload an invoice to get started.</p>;
  }

  return (
    <ul className={styles.list}>
      {documents.map((doc) => (
        <li key={doc.id} className={styles.item}>
          <button
            type="button"
            className={styles.name}
            onClick={() => onOpen?.(doc)}
            title={doc.fileName}
            style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            {doc.fileName} · {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'}
          </button>
          <span className={cx(styles.chip, chipClass[doc.status])}>{doc.status}</span>
          {doc.status === 'failed' ? (
            <button
              type="button"
              className={styles.retry}
              onClick={() => {
                retry(doc);
              }}
            >
              Retry
            </button>
          ) : null}
          <button
            type="button"
            className={styles.delete}
            onClick={() => {
              remove(doc);
            }}
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
