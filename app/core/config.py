"""Application configuration."""

import os
import re
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "resume.db"
BASE_TEMPLATES_DIR = DATA_DIR / "base"
DEFAULT_BASE = BASE_TEMPLATES_DIR / "Full_Stack.json"
PROMPTS_DIR = BASE_DIR / "prompts"

# Reserved dirs (excluded from job-dir scan)
DATA_RESERVED_DIRS = frozenset({"base", "_template_previews"})

# ── Jobright API settings ──
def _env(key: str, default: str = "") -> str:
    """Read from env (supports .env via dotenv loaded at startup)."""
    return os.environ.get(key, default)

JOBRIGHT_COOKIE = lambda: _env("JOBRIGHT_COOKIE")
JOBRIGHT_BASE_URL = _env(
    "JOBRIGHT_BASE_URL",
    "https://jobright.ai/swan/recommend/list/jobs",
)
JOBRIGHT_MAX_COUNT = int(_env("JOBRIGHT_MAX_COUNT", "20"))
# Max position for pagination; fetcher stops when a page returns no jobs (fetch all jobs)
JOBRIGHT_MAX_POSITION = int(_env("JOBRIGHT_MAX_POSITION", "50000"))
# Optional API param for "jobs since timestamp" (e.g. updatedSince); leave empty if API doesn't support
JOBRIGHT_SINCE_PARAM = _env("JOBRIGHT_SINCE_PARAM", "").strip()
JOBRIGHT_DELAY_BETWEEN = float(_env("JOBRIGHT_DELAY_BETWEEN_REQUESTS", "1.5"))
JOBRIGHT_DELAY_ON_ERROR = float(_env("JOBRIGHT_DELAY_ON_ERROR", "5.0"))
JOBRIGHT_SOURCE = _env("JOBRIGHT_SOURCE", "jobright")
JOBRIGHT_MARKET = _env("JOBRIGHT_MARKET", "us")
# Auto-fetch: run fetch every this many seconds after last fetch (default 1 hour)
JOBRIGHT_AUTO_FETCH_INTERVAL = int(_env("JOBRIGHT_AUTO_FETCH_INTERVAL", "3600"))
# How often to check whether to run auto-fetch (default 10 minutes)
JOBRIGHT_AUTO_FETCH_CHECK_INTERVAL = int(_env("JOBRIGHT_AUTO_FETCH_CHECK_INTERVAL", "600"))

# Prompt selection keywords: (regex, prompt_name)
# Names match: Full_Stack, AI_ML, Mobile, Game, Other
PROMPT_KEYWORDS: list[tuple[str, str]] = [
    (r"\b(game developer|game development|unity|unreal|game engine)\b", "Game"),
    (r"\b(machine learning|ML engineer|deep learning|AI engineer|LLM|transformers|GenAI|MLE)\b", "AI_ML"),
    (r"\b(data scientist|data science)\b", "AI_ML"),
    (r"\b(full stack|fullstack|backend|api|django|flask|fastapi|node\.?js|express|spring)\b", "Full_Stack"),
    (r"\b(mobile developer|ios developer|android developer|swift|react native|flutter)\b", "Mobile"),
    (r"\b(frontend|front-end|react|vue|angular|UI engineer)\b", "Full_Stack"),
]


def list_available_bases() -> list[str]:
    """Return sorted list of base template filenames (.json preferred, .txt fallback)."""
    if not BASE_TEMPLATES_DIR.exists():
        return []
    json_files = [p.name for p in BASE_TEMPLATES_DIR.iterdir() if p.is_file() and p.suffix == ".json"]
    txt_files = [p.name for p in BASE_TEMPLATES_DIR.iterdir() if p.is_file() and p.suffix == ".txt"]
    return sorted(set(json_files) | set(txt_files))


def list_available_prompts() -> list[str]:
    """Return sorted list of prompt names."""
    if not PROMPTS_DIR.exists():
        return ["Other", "Full_Stack", "AI_ML", "Mobile", "Game"]
    names = [p.stem for p in PROMPTS_DIR.iterdir() if p.is_file() and p.suffix == ".txt" and p.stem != "system"]
    return sorted(set(names))


def get_prompt_for_job(job_description: str) -> str:
    """Suggest prompt name from job description keywords."""
    for pattern, name in PROMPT_KEYWORDS:
        if re.search(pattern, job_description, re.IGNORECASE):
            path = PROMPTS_DIR / f"{name}.txt"
            if path.exists():
                return name
    return "Other" if (PROMPTS_DIR / "Other.txt").exists() else "default"


def load_prompt(name: str) -> str:
    """Load prompt from prompts/{name}.txt."""
    path = PROMPTS_DIR / f"{name}.txt"
    if not path.exists():
        path = PROMPTS_DIR / "default.txt"
    return path.read_text(encoding="utf-8").strip()


def load_system_prompt() -> str:
    """Load system prompt from prompts/system.txt."""
    path = PROMPTS_DIR / "system.txt"
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return (
        "You are an expert resume writer. You tailor resumes to job descriptions "
        "while keeping the candidate's real experience and the exact text structure required for parsing."
    )
