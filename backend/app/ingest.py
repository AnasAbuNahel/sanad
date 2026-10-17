"""Turn an uploaded file into page-tagged text chunks."""

import io
import re
from dataclasses import dataclass

from pypdf import PdfReader

SUPPORTED = {
    "application/pdf": "pdf",
    "text/plain": "text",
    "text/markdown": "text",
}
SUPPORTED_EXTENSIONS = {".pdf": "pdf", ".txt": "text", ".md": "text", ".markdown": "text"}


class UnsupportedFile(ValueError):
    pass


class EmptyDocument(ValueError):
    pass


@dataclass
class Piece:
    page: int
    text: str


def detect_kind(filename: str, media_type: str | None) -> str:
    lower = filename.lower()
    for ext, kind in SUPPORTED_EXTENSIONS.items():
        if lower.endswith(ext):
            return kind
    if media_type in SUPPORTED:
        return SUPPORTED[media_type]
    raise UnsupportedFile(filename)


def _clean(text: str) -> str:
    text = text.replace(" ", " ").replace("\r", "")
    text = re.sub(r"^\s*#{1,6}\s+", "", text, flags=re.M)  # markdown headings
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)  # markdown bold
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pages(data: bytes, kind: str) -> list[Piece]:
    if kind == "pdf":
        reader = PdfReader(io.BytesIO(data))
        pages = [Piece(i + 1, _clean(p.extract_text() or "")) for i, p in enumerate(reader.pages)]
    else:
        try:
            raw = data.decode("utf-8")
        except UnicodeDecodeError:
            raw = data.decode("cp1256", errors="replace")  # common for older Arabic text files
        pages = [Piece(1, _clean(raw))]
    pages = [p for p in pages if p.text]
    if not pages:
        raise EmptyDocument("no extractable text")
    return pages


_SENTENCE_END = re.compile(r"(?<=[.!?؟۔])\s+|\n+")


def _split_long(text: str, size: int) -> list[str]:
    """Split text into sentence-ish units no longer than `size`."""
    units: list[str] = []
    for part in _SENTENCE_END.split(text):
        part = part.strip()
        while len(part) > size:
            cut = part.rfind(" ", 0, size)
            cut = cut if cut > size // 2 else size
            units.append(part[:cut].strip())
            part = part[cut:].strip()
        if part:
            units.append(part)
    return units


def chunk_pages(pages: list[Piece], size: int = 900, overlap: int = 150) -> list[Piece]:
    """Greedy sentence packing per page, with a tail overlap between neighbours."""
    chunks: list[Piece] = []
    for page in pages:
        current = ""
        for unit in _split_long(page.text, size):
            if current and len(current) + 1 + len(unit) > size:
                chunks.append(Piece(page.page, current))
                tail = current[-overlap:] if overlap else ""
                space = tail.find(" ")
                current = (tail[space + 1 :] if space != -1 else tail) + " " + unit
            else:
                current = f"{current} {unit}" if current else unit
        if current.strip():
            chunks.append(Piece(page.page, current.strip()))
    return chunks


def title_from_filename(filename: str) -> str:
    stem = re.sub(r"\.[A-Za-z0-9]+$", "", filename)
    return re.sub(r"[_\-]+", " ", stem).strip() or filename
