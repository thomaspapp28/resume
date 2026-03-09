"""Database engine and session management."""

import logging
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import DB_PATH

# Use absolute path with forward slashes so SQLite always uses the same file
# (avoids Windows backslash issues and cwd-dependent relative paths)
_db_path = Path(DB_PATH).resolve()
_db_path.parent.mkdir(parents=True, exist_ok=True)
DATABASE_URL = "sqlite:///" + _db_path.as_posix()

logger = logging.getLogger(__name__)
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


def _drop_redundant_university_columns():
    """Drop university_name, university_date_from, university_date_to if present. Education data lives only in educations JSON."""
    with engine.connect() as conn:
        for col in ("university_name", "university_date_from", "university_date_to"):
            try:
                conn.execute(text(f"ALTER TABLE profiles DROP COLUMN {col}"))
                conn.commit()
                logger.info("Dropped redundant column profiles.%s", col)
            except Exception as e:
                conn.rollback()
                # Column may not exist (SQLite 3.35+ required for DROP COLUMN)
                if "no such column" not in str(e).lower() and "unknown column" not in str(e).lower():
                    logger.warning("Could not drop profiles.%s: %s", col, e)


def _migrate_educations_institution_to_university():
    """Migrate profile educations: rename institution_name -> university in stored JSON."""
    from app.models.profile import Profile
    session = SessionLocal()
    try:
        profiles = session.query(Profile).all()
        for p in profiles:
            edu_list = getattr(p, "educations", None) or []
            if not isinstance(edu_list, list):
                continue
            new_list = []
            changed = False
            for e in edu_list:
                if not isinstance(e, dict):
                    new_list.append(e)
                    continue
                if "institution_name" in e and "university" not in e:
                    e = dict(e)
                    e["university"] = e.pop("institution_name", "")
                    changed = True
                new_list.append(e)
            if changed:
                p.educations = new_list
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """Create tables and run migrations."""
    from app.models import profile  # noqa: F401
    from app.models import job  # noqa: F401

    logger.info("Database: %s", _db_path)
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        for col, default in [
            ("educations", "'[]'"),
            ("subtitle", "''"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE profiles ADD COLUMN {col} TEXT DEFAULT {default}"))
                conn.commit()
            except Exception:
                conn.rollback()
    # Migrate educations: institution_name -> university
    try:
        _migrate_educations_institution_to_university()
    except Exception as e:
        logger.warning("Education migration skipped or failed: %s", e)

    # Drop redundant university_* columns so only educations (JSON) remains
    _drop_redundant_university_columns()
