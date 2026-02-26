"""Database engine and session management."""

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import DB_PATH

DB_PATH.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yield DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables and run migrations."""
    from app.models import profile  # noqa: F401

    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE profiles ADD COLUMN educations TEXT DEFAULT '[]'"))
            conn.commit()
        except Exception:
            conn.rollback()
