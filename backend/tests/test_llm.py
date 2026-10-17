import uuid

from app.llm import build_messages
from app.schemas import Source, Turn


def _src(n):
    return Source(n=n, chunk_id=n, document_id=uuid.uuid4(), title="دليل", page=1, content="نص", score=0.9)


def test_messages_alternate_and_end_with_sources():
    history = [
        Turn(role="assistant", content="hi"),
        Turn(role="user", content="q1"),
        Turn(role="assistant", content="a1"),
        Turn(role="user", content="dangling"),
    ]
    msgs = build_messages("q2", history, [_src(1), _src(2)])
    assert [m["role"] for m in msgs] == ["user", "assistant", "user"]
    assert '<source n="2"' in msgs[-1]["content"] and msgs[-1]["content"].endswith("Question: q2")
