import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: uuid.UUID
    title: str
    filename: str
    media_type: str
    size_bytes: int
    page_count: int
    chunk_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=20000)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    history: list[Turn] = []
    document_ids: list[uuid.UUID] | None = None


class Source(BaseModel):
    n: int
    chunk_id: int
    document_id: uuid.UUID
    title: str
    page: int
    content: str
    score: float
