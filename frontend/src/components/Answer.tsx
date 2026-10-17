import { Fragment, type ReactNode } from "react";
import { arNum } from "../format";

interface Props {
  text: string;
  activeCite: number | null;
  validCites: Set<number>;
  onCite: (n: number) => void;
}

/** Minimal renderer: paragraphs, "- " lists, **bold**, and [n] citations. */
export default function Answer({ text, activeCite, validCites, onCite }: Props) {
  const inline = (line: string, key: string): ReactNode[] =>
    line.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
      const k = `${key}-${i}`;
      const cite = part.match(/^\[(\d+)\]$/);
      if (cite) {
        const n = Number(cite[1]);
        if (!validCites.has(n)) return null;
        return (
          <button
            key={k}
            type="button"
            className="cite"
            aria-pressed={activeCite === n}
            aria-label={`المصدر ${arNum(n)}`}
            onClick={() => onCite(n)}
          >
            {arNum(n)}
          </button>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={k}>{part.slice(2, -2)}</strong>;
      return <Fragment key={k}>{part}</Fragment>;
    });

  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      const items = list;
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {items.map((item, i) => (
            <li key={i}>{inline(item, `li-${blocks.length}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    if (line) blocks.push(<p key={`p-${blocks.length}`}>{inline(line, `p-${blocks.length}`)}</p>);
  }
  flush();
  return <div className="answer-body">{blocks}</div>;
}
