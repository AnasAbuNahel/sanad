import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://sanad:sanad@localhost:5432/sanad_test")
os.environ["EMBEDDING_PROVIDER"] = "hash"
