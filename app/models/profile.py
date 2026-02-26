"""Profile model for storing user resume information."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.dialects.sqlite import JSON

from app.core.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200), default="")
    email = Column(String(200), default="")
    location = Column(String(200), default="")
    phone = Column(String(50), default="")
    # JSON: [{ "company_name": str, "date_from": str, "date_to": str }, ...]  # date as YYYY-MM
    work_experiences = Column(JSON, default=list)
    # JSON: [{ "institution_name": str, "date_from": str, "date_to": str }, ...]  # date as YYYY-MM
    educations = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
