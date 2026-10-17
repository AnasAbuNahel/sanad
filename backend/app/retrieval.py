import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Chunk, Document
from .schemas import Source


def search(
    session: Session,
    query_vec: list[float],
    k: int,
    document_ids: list[uuid.UUID] | None = None,
) -> list[Source]:
    distance = Chunk.embedding.cosine_distance(query_vec).label("distance")
    stmt = (
        select(Chunk, Document.title, distance)
        .join(Document, Document.id == Chunk.document_id)
        .order_by(distance)
        .limit(k)
    )
    if document_ids:
        stmt = stmt.where(Chunk.document_id.in_(document_ids))
    rows = session.execute(stmt).all()
    return [
        Source(
            n=i + 1,
            chunk_id=chunk.id,
            document_id=chunk.document_id,
            title=title,
            page=chunk.page,
            content=chunk.content,
            score=round(1 - float(dist), 4),
        )
        for i, (chunk, title, dist) in enumerate(rows)
    ]
