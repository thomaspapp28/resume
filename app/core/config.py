"""Application configuration."""

import re
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "resume.db"
BASE_TEMPLATES_DIR = DATA_DIR / "base"
DEFAULT_BASE = BASE_TEMPLATES_DIR / "base1.json"
PROMPTS_DIR = BASE_DIR / "prompts"

# Reserved dirs (excluded from job-dir scan)
DATA_RESERVED_DIRS = frozenset({"base"})

# Prompt selection keywords: (regex, prompt_name)
PROMPT_KEYWORDS: list[tuple[str, str]] = [
    (r"\b(game developer|game development|unity|unreal|game engine)\b", "game_developer"),
    (r"\b(machine learning|ML engineer|deep learning|AI engineer|LLM|transformers|GenAI|MLE)\b", "ai_ml"),
    (r"\b(data scientist|data science)\b", "data_scientist"),
    (r"\b(full stack|fullstack|backend|api|django|flask|fastapi|node\.?js|express|spring)\b", "full_stack_backend"),
    (r"\b(mobile developer|ios developer|android developer|swift|react native|flutter)\b", "mobile_developer"),
    (r"\b(frontend|front-end|react|vue|angular|UI engineer)\b", "frontend"),
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
        return ["default"]
    names = [p.stem for p in PROMPTS_DIR.iterdir() if p.is_file() and p.suffix == ".txt" and p.stem != "system"]
    return sorted(set(names) | {"default"})


def get_prompt_for_job(job_description: str) -> str:
    """Suggest prompt name from job description keywords."""
    for pattern, name in PROMPT_KEYWORDS:
        if re.search(pattern, job_description, re.IGNORECASE):
            path = PROMPTS_DIR / f"{name}.txt"
            if path.exists():
                return name
    return "default"


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
