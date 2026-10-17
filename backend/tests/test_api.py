import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app import llm
from app.db import engine
from app.main import app
from app.routes import chat as chat_route


@pytest.fixture()
def client():
    with TestClient(app) as c:
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE documents CASCADE"))
        yield c


def _events(body: str):
    out = []
    for block in body.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def test_upload_list_chat_delete(client, monkeypatch):
    doc = (
        "سياسة الإجازات: يحصل كل موظف على ثلاثين يوماً من الإجازة السنوية المدفوعة.\n\n"
        "سياسة العمل عن بعد: يُسمح بالعمل من المنزل يومين في الأسبوع."
    )
    r = client.post("/api/documents", files={"file": ("hr-policy.txt", doc.encode(), "text/plain")})
    assert r.status_code == 201, r.text
    doc_id = r.json()["id"]
    assert r.json()["title"] == "hr policy"

    assert len(client.get("/api/documents").json()) == 1

    async def fake_answer(question, history, sources):
        yield "ثلاثون يوماً "
        yield "[1]"

    monkeypatch.setattr(chat_route, "stream_answer", fake_answer)
    r = client.post("/api/chat", json={"question": "كم يوم إجازة سنوية؟"})
    events = _events(r.text)
    assert events[0][0] == "sources" and "الإجازة" in events[0][1][0]["content"]
    assert "".join(d["text"] for e, d in events if e == "delta") == "ثلاثون يوماً [1]"
    assert events[-1][0] == "done"

    assert client.delete(f"/api/documents/{doc_id}").status_code == 204
    assert client.get("/api/documents").json() == []


def test_chat_with_empty_library(client):
    events = _events(client.post("/api/chat", json={"question": "مرحبا"}).text)
    assert events == [("error", {"message": "المكتبة فارغة. ارفع مستنداً واحداً على الأقل ثم اسأل."})]


def test_rejects_unsupported_file(client):
    r = client.post("/api/documents", files={"file": ("x.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 415
