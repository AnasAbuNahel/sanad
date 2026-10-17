import type { DocumentInfo, Source } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";

async function errorText(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* not JSON */
  }
  return `تعذّر إكمال الطلب (${res.status}).`;
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch(`${BASE}/api/documents`);
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/documents`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await errorText(res));
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await errorText(res));
}

export interface ChatHandlers {
  onSources: (sources: Source[]) => void;
  onDelta: (text: string) => void;
  onError: (message: string) => void;
  onDone: () => void;
}

/** POST /api/chat and read the server-sent event stream. */
export async function streamChat(
  body: { question: string; history: { role: string; content: string }[] },
  handlers: ChatHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return handlers.onDone();
    return handlers.onError("تعذّر الوصول إلى الخادم. تأكد أنه يعمل ثم أعد المحاولة.");
  }
  if (!res.ok || !res.body) return handlers.onError(await errorText(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let split: number;
      while ((split = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) event = line.slice(7);
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        const payload = data ? JSON.parse(data) : {};
        if (event === "sources") handlers.onSources(payload);
        else if (event === "delta") handlers.onDelta(payload.text);
        else if (event === "error") {
          finished = true;
          handlers.onError(payload.message);
        } else if (event === "done") {
          finished = true;
          handlers.onDone();
        }
      }
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      finished = true;
      handlers.onError("انقطع الاتصال أثناء كتابة الإجابة.");
    }
  }
  if (!finished) handlers.onDone();
}
