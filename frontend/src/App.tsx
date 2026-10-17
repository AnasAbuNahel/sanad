import { useCallback, useEffect, useRef, useState } from "react";
import Conversation from "./components/Conversation";
import Library from "./components/Library";
import SanadPanel from "./components/SanadPanel";
import { deleteDocument, listDocuments, streamChat, uploadDocument } from "./api";
import { arNum } from "./format";
import type { DocumentInfo, Message } from "./types";

type Sheet = "none" | "library" | "sanad";

const uid = () => Math.random().toString(36).slice(2);

export default function App() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCite, setActiveCite] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>("none");
  const abort = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDocs(await listDocuments());
      setLoadError(null);
    } catch {
      setLoadError("تعذّر الاتصال بالخادم. شغّل الواجهة الخلفية ثم حدّث الصفحة.");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setSheet("none");
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  const patch = (id: string, fn: (m: Message) => Message) =>
    setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));

  async function ask(question: string) {
    const history = messages
      .filter((m) => m.status !== "error" && m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    const q: Message = { id: uid(), role: "user", content: question };
    const a: Message = { id: uid(), role: "assistant", content: "", status: "streaming", sources: [] };
    setMessages((ms) => [...ms, q, a]);
    setActiveId(a.id);
    setActiveCite(null);

    const ctrl = new AbortController();
    abort.current = ctrl;
    await streamChat(
      { question, history },
      {
        onSources: (sources) => patch(a.id, (m) => ({ ...m, sources })),
        onDelta: (text) => patch(a.id, (m) => ({ ...m, content: m.content + text })),
        onError: (error) => patch(a.id, (m) => ({ ...m, status: "error", error })),
        onDone: () => patch(a.id, (m) => ({ ...m, status: "done" })),
      },
      ctrl.signal,
    );
    abort.current = null;
  }

  const streaming = messages.some((m) => m.status === "streaming");
  const active = messages.find((m) => m.id === activeId && m.role === "assistant") ?? null;
  const citedCount = active ? new Set(active.content.match(/\[\d+\]/g) ?? []).size : 0;

  return (
    <div className="shell" data-sheet={sheet}>
      <nav className="topbar" aria-label="التنقل">
        <button type="button" className="btn btn-ghost" onClick={() => setSheet("library")}>
          المكتبة ({arNum(docs.length)})
        </button>
        <span className="topbar-mark">سَنَد</span>
        <button type="button" className="btn btn-ghost" onClick={() => setSheet("sanad")} disabled={!active}>
          السند{citedCount ? ` (${arNum(citedCount)})` : ""}
        </button>
      </nav>

      <div className="pane pane-library">
        <Library
          docs={docs}
          loading={loadingDocs}
          onUpload={async (f) => {
            const d = await uploadDocument(f);
            setDocs((ds) => [d, ...ds]);
          }}
          onDelete={async (id) => {
            await deleteDocument(id);
            setDocs((ds) => ds.filter((d) => d.id !== id));
          }}
        />
        {loadError && <p className="error-line pad">{loadError}</p>}
      </div>

      <Conversation
        messages={messages}
        hasDocs={docs.length > 0}
        streaming={streaming}
        activeId={activeId}
        activeCite={activeCite}
        onAsk={ask}
        onStop={() => abort.current?.abort()}
        onSelectAnswer={(id) => {
          if (id !== activeId) {
            setActiveId(id);
            setActiveCite(null);
          }
        }}
        onCite={(id, n) => {
          setActiveId(id);
          setActiveCite(n);
          if (window.matchMedia("(max-width: 1080px)").matches) setSheet("sanad");
        }}
        onAddDocs={() => {
          setSheet("library");
          document.querySelector<HTMLButtonElement>(".drop .btn")?.click();
        }}
      />

      <div className="pane pane-sanad">
        <SanadPanel
          answer={active ? active.content : null}
          sources={active?.sources ?? []}
          activeCite={activeCite}
          onSelect={setActiveCite}
        />
      </div>

      <button type="button" className="scrim" aria-label="إغلاق" tabIndex={-1} onClick={() => setSheet("none")} />
    </div>
  );
}
