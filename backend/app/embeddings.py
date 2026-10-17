"""Embedding backends. fastembed runs a multilingual model locally (Arabic + English)."""

import hashlib
import re
from functools import lru_cache
from typing import Protocol

import numpy as np

from .config import get_settings


class Embedder(Protocol):
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class FastEmbedder:
    def __init__(self, model_name: str):
        from fastembed import TextEmbedding

        self.model = TextEmbedding(model_name)
        # e5 models expect role prefixes; MiniLM/mpnet do not.
        self.prefixes = ("query: ", "passage: ") if "e5" in model_name.lower() else ("", "")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [v.tolist() for v in self.model.embed([self.prefixes[1] + t for t in texts])]

    def embed_query(self, text: str) -> list[float]:
        return next(iter(self.model.embed([self.prefixes[0] + text]))).tolist()


_DIACRITICS = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")


def normalize_arabic(text: str) -> str:
    text = _DIACRITICS.sub("", text.lower())
    text = re.sub("[إأآٱ]", "ا", text)
    return text.replace("ى", "ي").replace("ة", "ه")


class HashEmbedder:
    """Character n-gram hashing. No model download — used offline and in tests."""

    def __init__(self, dim: int):
        self.dim = dim

    def _vec(self, text: str) -> list[float]:
        v = np.zeros(self.dim, dtype=np.float32)
        for word in re.findall(r"\w+", normalize_arabic(text)):
            padded = f"#{word}#"
            for n in (3, 4):
                for i in range(max(1, len(padded) - n + 1)):
                    h = hashlib.blake2b(padded[i : i + n].encode(), digest_size=8).digest()
                    idx = int.from_bytes(h[:4], "little") % self.dim
                    v[idx] += 1.0 if h[4] & 1 else -1.0
        norm = np.linalg.norm(v)
        return (v / norm if norm else v).tolist()

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vec(text)


@lru_cache
def get_embedder() -> Embedder:
    s = get_settings()
    if s.embedding_provider == "hash":
        return HashEmbedder(s.embedding_dim)
    return FastEmbedder(s.embedding_model)
