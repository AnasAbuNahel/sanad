import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_session
from ..embeddings import get_embedder
from ..ingest import EmptyDocument, UnsupportedFile, chunk_pages, detect_kind, extract_pages, title_from_filename
from ..models import Chunk, Document
from ..schemas import DocumentOut

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
def list_documents(session: Session = Depends(get_session)):
    return session.scalars(select(Document).order_by(Document.created_at.desc())).all()


@router.post("", response_model=DocumentOut, status_code=201)
def upload_document(file: UploadFile = File(...), session: Session = Depends(get_session)):
    s = get_settings()
    filename = file.filename or "document"
    try:
        kind = detect_kind(filename, file.content_type)
    except UnsupportedFile:
        raise HTTPException(415, "نوع الملف غير مدعوم. ارفع ملف PDF أو TXT أو Markdown.")

    data = file.file.read(s.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"حجم الملف أكبر من {s.max_upload_mb} ميغابايت.")

    try:
        pages = extract_pages(data, kind)
    except EmptyDocument:
        raise HTTPException(422, "لم نجد نصاً قابلاً للقراءة في هذا الملف. إن كان PDF ممسوحاً ضوئياً فحوّله إلى نص أولاً.")
    except Exception:
        raise HTTPException(422, "تعذّرت قراءة الملف. تأكد أنه غير تالف وغير محمي بكلمة مرور.")

    pieces = chunk_pages(pages, s.chunk_size, s.chunk_overlap)
    vectors = get_embedder().embed_documents([p.text for p in pieces])

    doc = Document(
        title=title_from_filename(filename),
        filename=filename,
        media_type=file.content_type or "application/octet-stream",
        size_bytes=len(data),
        page_count=max(p.page for p in pages),
        chunk_count=len(pieces),
    )
    doc.chunks = [
        Chunk(ordinal=i, page=p.page, content=p.text, embedding=v)
        for i, (p, v) in enumerate(zip(pieces, vectors))
    ]
    session.add(doc)
    session.commit()
    return doc


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: uuid.UUID, session: Session = Depends(get_session)):
    doc = session.get(Document, document_id)
    if doc is None:
        raise HTTPException(404, "المستند غير موجود.")
    session.delete(doc)
    session.commit()
