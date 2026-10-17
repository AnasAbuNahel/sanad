from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://sanad:sanad@localhost:5432/sanad"

    # Claude
    anthropic_model: str = "claude-opus-5-5"
    anthropic_effort: str = "low"  # low | medium | high — Q&A over sources rarely needs more
    max_answer_tokens: int = 16000

    # Embeddings: "fastembed" (multilingual, runs locally) or "hash" (offline, for tests)
    embedding_provider: str = "fastembed"
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    embedding_dim: int = 384

    # Retrieval
    chunk_size: int = 700
    chunk_overlap: int = 120
    top_k: int = 6
    history_turns: int = 6

    max_upload_mb: int = 20
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
