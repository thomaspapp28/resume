"""Claude-based resume tailoring."""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv(PROJECT_ROOT / ".env")
    except ImportError:
        pass


def _get_client():
    _load_env()
    from anthropic import Anthropic
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise SystemExit("ANTHROPIC_API_KEY not set. Set in .env or environment.")
    return Anthropic(api_key=key)


def _get_system_prompt() -> str:
    from app.core.config import load_system_prompt
    return load_system_prompt()


def generate_resume(
    base_resume: str,
    job_description: str,
    instruction_prompt: str | None = None,
    model: str = "claude-sonnet-4-20250514",
) -> str:
    """Call Claude to tailor base resume to job description. Returns resume text."""
    if not instruction_prompt:
        from app.core.config import get_prompt_for_job, load_prompt
        prompt_name = get_prompt_for_job(job_description)
        instruction_prompt = load_prompt(prompt_name)

    user_content = (
        f"{instruction_prompt}\n\n---\n\n"
        "**BASE RESUME (style and structure to preserve):**\n\n"
        f"{base_resume}\n\n---\n\n"
        f"{job_description}\n\n---\n\n"
        "Produce the updated resume as plain text only, in the same structure as the base resume."
    )

    client = _get_client()
    response = client.messages.create(
        model=os.environ.get("GENERATION_MODEL", model),
        max_tokens=8192,
        system=_get_system_prompt(),
        messages=[{"role": "user", "content": user_content}],
    )
    text = response.content[0].text
    return text.strip() if text else ""


def main():
    """CLI: generate for data/base/base1.txt and data/1/jd.txt."""
    base_path = PROJECT_ROOT / "data" / "base" / "base1.txt"
    jd_path = PROJECT_ROOT / "data" / "1" / "jd.txt"
    out_path = PROJECT_ROOT / "data" / "1" / "context.txt"
    if not base_path.exists() or not jd_path.exists():
        print("Requires data/base/base1.txt and data/1/jd.txt")
        return
    base = base_path.read_text(encoding="utf-8").strip()
    jd = jd_path.read_text(encoding="utf-8").strip()
    result = generate_resume(base, jd)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(result, encoding="utf-8")
    print(f"Saved: {out_path}")


if __name__ == "__main__":
    main()
