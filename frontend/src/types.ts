export interface DocumentInfo {
  id: string;
  title: string;
  filename: string;
  media_type: string;
  size_bytes: number;
  page_count: number;
  chunk_count: number;
  created_at: string;
}

export interface Source {
  n: number;
  chunk_id: number;
  document_id: string;
  title: string;
  page: number;
  content: string;
  score: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  status?: "streaming" | "done" | "error";
  error?: string;
}
