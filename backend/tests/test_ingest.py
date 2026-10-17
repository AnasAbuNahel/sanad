from app.embeddings import HashEmbedder, normalize_arabic
from app.ingest import Piece, chunk_pages, detect_kind, title_from_filename


def test_detect_kind():
    assert detect_kind("report.PDF", None) == "pdf"
    assert detect_kind("notes.md", None) == "text"


def test_chunks_respect_size_and_keep_pages():
    sentence = "هذه جملة تجريبية عن سياسة الإجازات السنوية للموظفين. "
    pages = [Piece(1, sentence * 40), Piece(2, "Short page two.")]
    chunks = chunk_pages(pages, size=300, overlap=60)
    assert len(chunks) > 3
    assert all(len(c.text) <= 300 + 60 + 60 for c in chunks)
    assert chunks[-1].page == 2


def test_title_from_filename():
    assert title_from_filename("hr_policy-2026.pdf") == "hr policy 2026"


def test_arabic_normalization_matches_variants():
    assert normalize_arabic("إِجَازَة") == normalize_arabic("اجازه")
    e = HashEmbedder(384)
    a, b, c = e.embed_query("الإجازة السنوية"), e.embed_query("اجازه سنويه"), e.embed_query("الرواتب الشهرية")
    dot = lambda x, y: sum(i * j for i, j in zip(x, y))
    assert dot(a, b) > dot(a, c)
