import { useEffect, useRef, useState } from "react";
import type { Source } from "../types";
import { arNum, citedNumbers } from "../format";

interface Props {
  answer: string | null;
  sources: Source[];
  activeCite: number | null;
  onSelect: (n: number) => void;
}

function Node({ s, active, onSelect }: { s: Source; active: boolean; onSelect: (n: number) => void }) {
  const ref = useRef<HTMLLIElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (active) {
      setOpen(true);
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [active]);
  return (
    <li ref={ref} className="link-node" data-active={active}>
      <button type="button" className="node-mark" aria-label={`المصدر ${arNum(s.n)}`} onClick={() => onSelect(s.n)}>
        {arNum(s.n)}
      </button>
      <div className="node-body">
        <p className="node-ref">
          <span className="node-doc">{s.title}</span>
          <span className="node-page">ص {arNum(s.page)}</span>
        </p>
        <blockquote className="node-quote" data-open={open}>
          {s.content}
        </blockquote>
        <button type="button" className="link" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "اختصر" : "اقرأ المقطع كاملاً"}
        </button>
      </div>
    </li>
  );
}

export default function SanadPanel({ answer, sources, activeCite, onSelect }: Props) {
  const [showUncited, setShowUncited] = useState(false);
  if (answer === null) {
    return (
      <aside className="sanad" aria-label="سند الإجابة">
        <h2 className="section-title">السَّنَد</h2>
        <p className="empty-note">
          حين تصلك إجابة، تظهر هنا سلسلة المقاطع التي استندت إليها، مرتبةً كما وردت في الإجابة.
        </p>
      </aside>
    );
  }
  const order = citedNumbers(answer);
  const cited = order.map((n) => sources.find((s) => s.n === n)).filter(Boolean) as Source[];
  const uncited = sources.filter((s) => !order.includes(s.n));

  return (
    <aside className="sanad" aria-label="سند الإجابة">
      <h2 className="section-title">السَّنَد</h2>
      {cited.length > 0 ? (
        <ol className="chain">
          <li className="chain-head" aria-hidden="true">
            <span className="node-mark head" />
            <span className="chain-head-label">الإجابة</span>
          </li>
          {cited.map((s) => (
            <Node key={s.n} s={s} active={activeCite === s.n} onSelect={onSelect} />
          ))}
        </ol>
      ) : (
        <p className="empty-note">لم تستشهد هذه الإجابة بأي مقطع بعد.</p>
      )}
      {uncited.length > 0 && (
        <div className="uncited">
          <button type="button" className="link" aria-expanded={showUncited} onClick={() => setShowUncited(!showUncited)}>
            {showUncited ? "أخفِ" : "اعرض"} مقاطع اطّلع عليها ولم يستشهد بها ({arNum(uncited.length)})
          </button>
          {showUncited && (
            <ol className="chain chain-faint">
              {uncited.map((s) => (
                <Node key={s.n} s={s} active={activeCite === s.n} onSelect={onSelect} />
              ))}
            </ol>
          )}
        </div>
      )}
    </aside>
  );
}
