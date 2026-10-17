import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Message } from "../types";
import Answer from "./Answer";

interface Props {
  messages: Message[];
  hasDocs: boolean;
  streaming: boolean;
  activeId: string | null;
  activeCite: number | null;
  onAsk: (q: string) => void;
  onStop: () => void;
  onSelectAnswer: (id: string) => void;
  onCite: (id: string, n: number) => void;
  onAddDocs: () => void;
}

const STARTERS = ["لخّص أهم ما تقوله هذه المستندات", "ما المواعيد والمبالغ المذكورة؟", "ما الالتزامات المطلوبة مني؟"];

export default function Conversation(p: Props) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const last = p.messages[p.messages.length - 1];

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [p.messages.length, last?.content]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const q = draft.trim();
    if (!q || p.streaming) return;
    p.onAsk(q);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  }

  return (
    <main className="conversation">
      <div className="thread" aria-live="polite">
        {p.messages.length === 0 ? (
          <section className="welcome">
            <p className="entry-word">سَنَد</p>
            <p className="entry-def">
              <span className="entry-pos">اسم</span> ما يُستنَد إليه ويُعتمَد عليه.
            </p>
            <p className="welcome-lead">
              اسأل مستنداتك بلغتك. كل إجابة تأتي ومعها سندُها: المقطع والصفحة التي أُخذت منها، فتتحقق بنفسك.
            </p>
            {p.hasDocs ? (
              <div className="starters">
                {STARTERS.map((s) => (
                  <button key={s} type="button" className="starter" onClick={() => p.onAsk(s)}>
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <button type="button" className="btn btn-primary" onClick={p.onAddDocs}>
                ارفع أول مستند
              </button>
            )}
          </section>
        ) : (
          p.messages.map((m) =>
            m.role === "user" ? (
              <p key={m.id} className="question">
                {m.content}
              </p>
            ) : (
              <article
                key={m.id}
                className="answer"
                data-active={p.activeId === m.id}
                data-status={m.status}
                onClick={() => p.onSelectAnswer(m.id)}
              >
                {m.content ? (
                  <Answer
                    text={m.content}
                    activeCite={p.activeId === m.id ? p.activeCite : null}
                    validCites={new Set((m.sources ?? []).map((s) => s.n))}
                    onCite={(n) => p.onCite(m.id, n)}
                  />
                ) : m.status === "streaming" ? (
                  <p className="thinking">نقرأ المقاطع ذات الصلة…</p>
                ) : null}
                {m.status === "error" && <p className="error-line">{m.error}</p>}
              </article>
            ),
          )
        )}
        <div ref={end} />
      </div>

      <form className="composer" onSubmit={submit}>
        <label htmlFor="ask" className="visually-hidden">
          سؤالك
        </label>
        <textarea
          id="ask"
          ref={box}
          rows={1}
          value={draft}
          placeholder={p.hasDocs ? "اسأل عن أي شيء في مستنداتك" : "ارفع مستنداً أولاً، ثم اسأل عنه"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
        />
        {p.streaming ? (
          <button type="button" className="btn btn-ghost" onClick={p.onStop}>
            أوقف
          </button>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
            اسأل
          </button>
        )}
      </form>
    </main>
  );
}
