"""Job listing endpoints — browse, search, and manage fetched jobs."""

import threading
import time
import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import JOBRIGHT_AUTO_FETCH_CHECK_INTERVAL, JOBRIGHT_AUTO_FETCH_INTERVAL
from app.core.database import get_db, SessionLocal
from app.models.job import Job, JobFetchLog, STATUS_NEW, STATUS_NORMAL, STATUS_APPLIED

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs")

_fetch_lock = threading.Lock()
_fetch_running = False


# ── Schemas ──

class JobResponse(BaseModel):
    id: int
    jobright_id: str
    title: str
    company: str
    location: str
    description: str
    url: str
    salary: str
    job_type: str
    posted_date: str
    source: str
    status: str
    created_at: str
    updated_at: str


class JobListItem(BaseModel):
    id: int
    jobright_id: str
    title: str
    company: str
    location: str
    url: str
    salary: str
    job_type: str
    status: str
    created_at: str


class JobStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(new|normal|applied)$")


class FetchResponse(BaseModel):
    message: str
    already_running: bool = False


class FetchStatsResponse(BaseModel):
    source: str = ""
    jobs_found: int = 0
    jobs_new: int = 0
    jobs_updated: int = 0
    jobs_duplicate: int = 0
    pages_fetched: int = 0
    duration_seconds: float = 0
    stopped_early: bool = False
    error_message: str | None = None


# ── Helpers ──

def _effective_status(job: Job) -> str:
    if job.status == STATUS_APPLIED:
        return STATUS_APPLIED
    if job.status == STATUS_NEW and job.created_at:
        if datetime.utcnow() - job.created_at > timedelta(hours=24):
            return STATUS_NORMAL
    return job.status


def _job_to_list_item(job: Job) -> JobListItem:
    return JobListItem(
        id=job.id,
        jobright_id=job.jobright_id or "",
        title=job.title or "",
        company=job.company or "",
        location=job.location or "",
        url=job.url or "",
        salary=job.salary or "",
        job_type=job.job_type or "",
        status=_effective_status(job),
        created_at=job.created_at.isoformat() if job.created_at else "",
    )


def _job_to_response(job: Job) -> JobResponse:
    return JobResponse(
        id=job.id,
        jobright_id=job.jobright_id or "",
        title=job.title or "",
        company=job.company or "",
        location=job.location or "",
        description=job.description or "",
        url=job.url or "",
        salary=job.salary or "",
        job_type=job.job_type or "",
        posted_date=job.posted_date or "",
        source=job.source or "",
        status=_effective_status(job),
        created_at=job.created_at.isoformat() if job.created_at else "",
        updated_at=job.updated_at.isoformat() if job.updated_at else "",
    )


# ── Background fetch (used by manual trigger and auto-fetch) ──

def _run_fetch_in_background():
    """Run job fetch in the current thread. Caller must ensure _fetch_running is False and hold _fetch_lock if needed."""
    global _fetch_running
    _fetch_running = True
    logger.info("[Job fetch] Started. Fetching from Jobright API, saving to database.")
    try:
        from app.services.jobright_fetcher import run_jobright_fetch
        db = SessionLocal()
        try:
            result = run_jobright_fetch(db)
            logger.info("[Job fetch] Result: %s", result)
        finally:
            db.close()
    except Exception as e:
        logger.exception("[Job fetch] Failed: %s", e)
    finally:
        _fetch_running = False
        logger.info("[Job fetch] Finished.")


def _auto_fetch_loop():
    """Background loop: every CHECK_INTERVAL, if 1 hour (or configured interval) has passed since last fetch, run fetch."""
    while True:
        try:
            time.sleep(JOBRIGHT_AUTO_FETCH_CHECK_INTERVAL)
            with _fetch_lock:
                if _fetch_running:
                    continue
                db = SessionLocal()
                try:
                    log = db.query(JobFetchLog).order_by(JobFetchLog.created_at.desc()).first()
                    last_at = log.created_at if log and log.created_at else None
                finally:
                    db.close()
                if last_at is None:
                    continue
                elapsed = (datetime.utcnow() - last_at).total_seconds()
                if elapsed < JOBRIGHT_AUTO_FETCH_INTERVAL:
                    continue
                logger.info("[Job fetch] Auto-fetch: %s s since last fetch, triggering.", int(elapsed))
                threading.Thread(target=_run_fetch_in_background, daemon=True).start()
        except Exception as e:
            logger.exception("[Job fetch] Auto-fetch loop error: %s", e)


def start_auto_fetch_thread():
    """Start the daemon thread that runs auto-fetch every interval from last fetch."""
    t = threading.Thread(target=_auto_fetch_loop, daemon=True)
    t.start()
    logger.info(
        "[Job fetch] Auto-fetch thread started (every %s s after last fetch, check every %s s).",
        JOBRIGHT_AUTO_FETCH_INTERVAL,
        JOBRIGHT_AUTO_FETCH_CHECK_INTERVAL,
    )


# ── Endpoints ──

@router.post("/fetch", response_model=FetchResponse)
def trigger_fetch():
    """Trigger a Jobright job fetch in a background thread. Jobs are saved to the database."""
    global _fetch_running
    with _fetch_lock:
        if _fetch_running:
            logger.info("[Job fetch] Already running — skip.")
            return FetchResponse(message="Fetch already running", already_running=True)
        _fetch_running = True
    thread = threading.Thread(target=_run_fetch_in_background, daemon=True)
    thread.start()
    logger.info("[Job fetch] Triggered. Status: running.")
    return FetchResponse(message="Fetch started in background")


@router.get("/fetch/status")
def fetch_status():
    """Check if a fetch is currently running."""
    return {"running": _fetch_running}


@router.get("/fetch/last")
def last_fetch_time(db: Session = Depends(get_db)):
    """Return the last completed fetch time (from most recent JobFetchLog)."""
    log = db.query(JobFetchLog).order_by(JobFetchLog.created_at.desc()).first()
    if not log or not log.created_at:
        return {"last_fetch_at": None}
    return {"last_fetch_at": log.created_at.isoformat()}


@router.get("", response_model=list[JobListItem])
def list_jobs(
    status: str | None = Query(None, pattern="^(new|normal|applied)$"),
    search: str | None = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """List fetched jobs with optional filtering."""
    query = db.query(Job).order_by(Job.created_at.desc())

    if status == STATUS_APPLIED:
        query = query.filter(Job.status == STATUS_APPLIED)
    elif status == STATUS_NEW:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        query = query.filter(Job.status == STATUS_NEW, Job.created_at >= cutoff)
    elif status == STATUS_NORMAL:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        query = query.filter(
            ((Job.status == STATUS_NORMAL) |
             ((Job.status == STATUS_NEW) & (Job.created_at < cutoff)))
        )

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            Job.title.ilike(pattern) | Job.company.ilike(pattern) | Job.location.ilike(pattern)
        )

    offset = (page - 1) * limit
    jobs = query.offset(offset).limit(limit).all()
    return [_job_to_list_item(j) for j in jobs]


@router.get("/count")
def job_counts(db: Session = Depends(get_db)):
    """Return count of jobs by effective status."""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    total = db.query(Job).count()
    applied = db.query(Job).filter(Job.status == STATUS_APPLIED).count()
    new = db.query(Job).filter(Job.status == STATUS_NEW, Job.created_at >= cutoff).count()
    normal = total - applied - new
    return {"total": total, "new": new, "normal": normal, "applied": applied}


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get full job details including description."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_response(job)


@router.patch("/{job_id}", response_model=JobResponse)
def update_job_status(job_id: int, body: JobStatusUpdate, db: Session = Depends(get_db)):
    """Update a job's status (new, normal, applied)."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = body.status
    db.commit()
    db.refresh(job)
    return _job_to_response(job)


@router.get("/logs/recent", response_model=list[dict])
def fetch_logs(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    """Return recent fetch log entries."""
    logs = db.query(JobFetchLog).order_by(JobFetchLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": log.id,
            "source": log.source or "",
            "jobs_found": log.jobs_found,
            "jobs_new": log.jobs_new,
            "jobs_updated": log.jobs_updated,
            "jobs_duplicate": log.jobs_duplicate,
            "duration_seconds": log.duration_seconds,
            "error_message": log.error_message or "",
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log in logs
    ]
