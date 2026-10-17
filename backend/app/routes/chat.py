import json
import logging

import anthropic
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select

from ..config import get_settings
from ..db import SessionLocal
from ..embeddings import get_embedder
from ..llm import RefusedError, stream_answer
from ..models import Document
from ..retrieval import search
from ..schemas import ChatRequest

router = APIRouter(prefix="/api", tags=["chat"])
log = logging.getLogger("sanad.chat")


def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def _error_message(exc: Exception) -> str:
    if isinstance(exc, RefusedError):
        return "لا يمكن الإجابة عن هذا السؤال. جرّب صياغة مختلفة."
    if isinstance(exc, anthropic.AuthenticationError):
        return "مفتاح Claude API غير صالح. راجع ANTHROPIC_API_KEY في إعدادات الخادم."
    if isinstance(exc, anthropic.RateLimitError):
        return "تم تجاوز حدّ الطلبات مؤقتاً. حاول بعد دقيقة."
    if isinstance(exc, anthropic.APIConnectionError):
        return "تعذّر الاتصال بخدمة Claude. تحقّق من الاتصال بالإنترنت."
    if isinstance(exc, anthropic.APIStatusError):
        return f"خدمة Claude أعادت خطأ ({exc.status_code}). حاول مرة أخرى."
    if isinstance(exc, TypeError) and "api_key" in str(exc).lower():
        return "لم يُضبط مفتاح Claude API. أضف ANTHROPIC_API_KEY إلى ملف ‎.env‎ ثم أعد تشغيل الخادم."
    return "حدث خطأ غير متوقع أثناء توليد الإجابة."


@router.post("/chat")
async def chat(req: ChatRequest):
    s = get_settings()

    async def events():
        with SessionLocal() as session:
            if not session.scalar(select(func.count()).select_from(Document)):
                yield sse("error", {"message": "المكتبة فارغة. ارفع مستنداً واحداً على الأقل ثم اسأل."})
                return
            vec = get_embedder().embed_query(req.question)
            sources = search(session, vec, s.top_k, req.document_ids)

        yield sse("sources", [src.model_dump(mode="json") for src in sources])
        history = req.history[-s.history_turns * 2 :]
        try:
            async for text in stream_answer(req.question, history, sources):
                yield sse("delta", {"text": text})
        except Exception as exc:  # surfaced to the UI, logged in full here
            log.exception("answer failed")
            yield sse("error", {"message": _error_message(exc)})
            return
        yield sse("done", {})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
