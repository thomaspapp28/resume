"""Job and JobFetchLog models for storing fetched job listings."""

from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, Text

from app.core.database import Base

# Status values: "new" (within 24h of fetch), "normal" (after 24h), "applied"
STATUS_NEW = "new"
STATUS_NORMAL = "normal"
STATUS_APPLIED = "applied"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    jobright_id = Column(String(200), unique=True, index=True, nullable=False)
    title = Column(String(500), default="")
    company = Column(String(300), default="")
    location = Column(String(300), default="")
    description = Column(Text, default="")
    url = Column(String(1000), default="")
    salary = Column(String(200), default="")
    job_type = Column(String(100), default="")
    posted_date = Column(String(100), default="")
    source = Column(String(50), default="jobright")
    market = Column(String(20), default="us")
    status = Column(String(20), default=STATUS_NEW, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def effective_status(self) -> str:
        """Return status with auto-downgrade: 'new' becomes 'normal' after 24h."""
        if self.status == STATUS_APPLIED:
            return STATUS_APPLIED
        if self.status == STATUS_NEW and self.created_at:
            if datetime.utcnow() - self.created_at > timedelta(hours=24):
                return STATUS_NORMAL
        return self.status


class JobFetchLog(Base):
    __tablename__ = "job_fetch_logs"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(50), default="jobright")
    jobs_found = Column(Integer, default=0)
    jobs_new = Column(Integer, default=0)
    jobs_updated = Column(Integer, default=0)
    jobs_duplicate = Column(Integer, default=0)
    duration_seconds = Column(Integer, default=0)
    error_message = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
