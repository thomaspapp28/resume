"""FastAPI application entry point."""

import logging
import sys
from pathlib import Path

# Load .env so JOBRIGHT_COOKIE, ANTHROPIC_API_KEY, etc. are available
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

# Configure logging so app loggers (e.g. job fetch) show in CLI
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
    force=True,
)
# Reduce uvicorn access log noise (optional); keep our app logs
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import init_db
from app.routers import api_router

init_db()

app = FastAPI(
    title="Resume from Job Description",
    description="Paste a job description and receive a tailored resume (text, .docx, .pdf).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
def startup_auto_fetch():
    """Start background thread that auto-fetches jobs every interval from last fetch."""
    from app.routers.jobs import start_auto_fetch_thread
    start_auto_fetch_thread()
