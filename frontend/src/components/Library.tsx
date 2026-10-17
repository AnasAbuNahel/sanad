import { useRef, useState, type DragEvent } from "react";
import type { DocumentInfo } from "../types";
import { pages, passages } from "../format";

interface Upload {
  name: string;
  error?: string;
}

interface Props {
  docs: DocumentInfo[];
  loading: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const ACCEPT = ".pdf,.txt,.md,.markdown";

export default function Library({ docs, loading, onUpload, onDelete }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      setUploads((u) => [...u, { name: file.name }]);
      try {
        await onUpload(file);
        setUploads((u) => u.filter((x) => x.name !== file.name));
      } catch (e) {
        const msg = (e as Error).message;
        setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, error: msg } : x)));
      }
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <aside className="library" aria-label="المكتبة">
      <header className="brand">
        <h1 className="wordmark">سَنَد</h1>
        <p className="tagline">إجابات من مستنداتك، ومع كل إجابة سندُها.</p>
      </header>

      <div
        className="drop"
        data-dragging={dragging}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>
          أضف مستنداً
        </button>
        <p className="drop-hint">أو اسحب الملف إلى هنا. يقبل PDF و TXT و Markdown.</p>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <h2 className="section-title">المستندات</h2>
      <ul className="doc-list">
        {uploads.map((u) => (
          <li key={`up-${u.name}`} className="doc" data-state={u.error ? "error" : "uploading"}>
            <span className="doc-title">{u.name}</span>
            {u.error ? (
              <span className="doc-meta doc-error">
                {u.error}{" "}
                <button type="button" className="link" onClick={() => setUploads((x) => x.filter((y) => y !== u))}>
                  إخفاء
                </button>
              </span>
            ) : (
              <span className="doc-meta">نقرأ الملف ونفهرسه…</span>
            )}
          </li>
        ))}
        {docs.map((d) => (
          <li key={d.id} className="doc">
            <span className="doc-title" title={d.filename}>
              {d.title}
            </span>
            <span className="doc-meta">
              {pages(d.page_count)}، {passages(d.chunk_count)}
            </span>
            {confirming === d.id ? (
              <span className="doc-actions">
                <button
                  type="button"
                  className="link danger"
                  onClick={async () => {
                    setConfirming(null);
                    await onDelete(d.id);
                  }}
                >
                  تأكيد الحذف
                </button>
                <button type="button" className="link" onClick={() => setConfirming(null)}>
                  إلغاء
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="icon-btn doc-remove"
                aria-label={`حذف ${d.title}`}
                onClick={() => setConfirming(d.id)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
      {!loading && docs.length === 0 && uploads.length === 0 && (
        <p className="empty-note">لا توجد مستندات بعد. ابدأ بملف واحد: دليل موظفين، أو عقد، أو بحث.</p>
      )}
    </aside>
  );
}
