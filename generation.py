"""
Generate context.txt by tailoring base.txt resume to the job description.
Uses Anthropic (Claude) to align the resume with the job posting while keeping base structure.

Usage:
  Set ANTHROPIC_API_KEY in environment or .env file.
  Run: python Generation.py

Optional .env (or environment):
  GENERATION_MODEL    - Claude model id (default: claude-sonnet-4-20250514)
  GENERATION_TEMPERATURE - 0.0 to 1.0; lower = more deterministic (default: 0.3)
  GENERATION_TOP_P    - 0.0 to 1.0; nucleus sampling. Use temp OR top_p, not both.

Inputs:  base.txt, job description.txt (in same folder)
Output:  context.txt (then run build_resume_docx.py to create resume.docx)
"""

import os
import sys
from pathlib import Path


def load_env():
    """Load .env if python-dotenv is available."""
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass


def load_file(path: Path) -> str:
    """Load text file with UTF-8."""
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()


def save_file(path: Path, content: str) -> None:
    """Save text file with UTF-8."""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Saved: {path}")


def get_anthropic_client():
    """Return Anthropic client."""
    load_env()
    try:
        from anthropic import Anthropic
    except ImportError:
        print("Installing anthropic...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "anthropic"])
        from anthropic import Anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit(
            "ANTHROPIC_API_KEY not set. Set it in the environment or in a .env file.\n"
            "Install python-dotenv for .env support: pip install python-dotenv"
        )
    return Anthropic(api_key=api_key)


RESUME_UPDATE_INSTRUCTIONS = """
Update my resume for best match to the job description while keeping it believable as a real human career: not every company did the same thing, and older roles must use period-appropriate technologies.

**1. Job Title**
- Set to the target role or closest equivalent (e.g. Full Stack Engineer, Senior Software Engineer, Senior Learning Engineer)

**2. Profile Summary**
- Rewrite in 2-3 sentences around experience and skills that align with the job description.
- Emphasize value for the target role and include key terms from the posting.
- Regarding to skills only one sentence for major skills, others for achievements and personal skills.

**3. Skills Section**
- Every required and preferred skill from the job description must appear somewhere on the resume (skills section and/or work experience). And add some related skills that are not in the job description but are related to the job description and important for the job.
- List only skills I actually possess; prioritize and group by category (e.g. Back-End, Front-End, Cloud, Tools).
- Order so the most relevant skills for the job are prominent.

**4. Work Experience (most important)**

Goal: Full coverage of job-description skills, but distributed like a real career—strongest match in the latest role, some overlap in others, early roles with legacy, period-appropriate tech only.

(a) Coverage
- Every important skill/requirement from the job description must appear somewhere (current role, past roles, or skills section).
- Where it fits naturally, show the skill in a role, not only in the skills list.
- First sentence for each company is for not technical skills, focusing on business logic and project focus summary, and last company domain should be same with the job description, the other companies domain should be different from the job description.

(b) Latest / most recent role (current or most recent job)
- This role must be the strongest match to the job description.
- Emphasize the most important required and preferred skills here (main tech stack, key responsibilities, tools).
- Write bullets so this role clearly shows the candidate is a strong fit for the target position.
- Use present tense if current role, past tense if recently ended.

(d) Other / middle-career roles (1–2 companies before the latest)
- Show some of the job-description skills—spread across these roles so it feels like natural progression.
- Vary focus by company (e.g. one role more API/backend, another more frontend or data) so it does not look like every company did the same thing.
- Do not force every JD skill into every role; real resumes show different emphases at different jobs.

(e) Early-career roles (oldest positions by date)
- Use only legacy, period-appropriate frameworks, tools, and practices for that time period.
- Do NOT use technologies that were not common or did not exist then (e.g. no Docker/Kubernetes in 2010; no React 18 in 2012; no GenAI/LLM in 2015 unless clearly appropriate).
- Examples for older periods: older Java/Python versions, SVN, jQuery, Bootstrap 2/3, Django 1.x, early AWS services, older RDBMS tooling, classic web stacks.
- The experience must read as believable for someone working in that era; avoid anachronistic buzzwords.

(f) General
- Keep the same companies and date ranges as the base resume. Do not add or remove roles.
- For the lastest 2 positions, update the job title to the target role or closest equivalent but both not completely same with the job description. And the lastest 2 positions should be the most recent 2 positions. Keep the same job title for the other positions.
- Consist as many as possible skills in the job description and related skills in the lastest 2 positions, and some in previous positions.
- Keep roughly the same number of bullets per role as in the base resume.
- Use action verbs and quantify where possible (performance, scale, team size, time saved).
- Past tense for past roles, present tense for current role only.
- Give me sentences like human writing, not like a robot.

**5. Certifications**
- Prioritize or add certifications that match the job description; remove or de-emphasize less relevant ones.
- List only real, plausible certifications (no fabrication).

**6. Format and style**
- Professional, ATS-friendly wording; consistent verb tense; concise bullets.
- No markdown, no "Updated Resume" or extra headers—only the resume text.

**Output format (critical):**
- Output ONLY the updated resume as plain text.
- Use the EXACT same structure and section labels as the base resume:
  - Line 1: Full name
  - Line 2: Job title (updated) and key tech stack
  - Line 3: blank
  - Line 4: contact (email, phone, location) with spaces/tabs between
  - Line 5: blank
  - PROFILE (heading), one summary paragraph, blank, then skill lines (Category: item1, item2, ...)
  - WORK EXPERIENCE (heading), then for each job: Job Title – Company, date/location line, one description paragraph, bullet lines starting with "-"
  - EDUCATION (heading), school – degree, date, location
  - CERTIFICATIONS (heading), lines like "- Certification Name\tIssuer"
- Preserve blank lines and use tab between certification name and issuer where shown in base."""


def build_user_message(base_resume: str, job_description: str) -> str:
    """Build the user message for Claude."""
    return (
        f"{RESUME_UPDATE_INSTRUCTIONS}\n\n"
        "---\n\n"
        "**BASE RESUME (style and structure to preserve):**\n\n"
        f"{base_resume}\n\n"
        "---\n\n"
        "**JOB DESCRIPTION:**\n\n"
        f"{job_description}\n\n"
        "---\n\n"
        "Produce the updated resume as plain text only, in the same structure as the base resume."
    )


SYSTEM_PROMPT = (
    "You are an expert resume writer. You tailor resumes to job descriptions "
    "while keeping the candidate's real experience and the exact text structure required for parsing."
)

DEFAULT_MODEL = "claude-opus-4-6"
DEFAULT_TEMPERATURE = 0.3  # 0.0 = deterministic, 1.0 = more random


def _float_env(name: str, default: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Read float from environment, clamp to [min_val, max_val]. Returns default if unset or invalid."""
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        v = float(raw.strip())
        return max(min_val, min(max_val, v))
    except ValueError:
        return default


def generate_resume(
    base_resume: str,
    job_description: str,
    model: str = DEFAULT_MODEL,
    temperature: float | None = None,
    top_p: float | None = None,
) -> str:
    """Call Anthropic API and return the generated resume text."""
    import anthropic
    load_env()
    if temperature is None:
        temperature = _float_env("GENERATION_TEMPERATURE", DEFAULT_TEMPERATURE)
    raw_top_p = os.environ.get("GENERATION_TOP_P")
    if top_p is None and raw_top_p is not None and raw_top_p.strip() != "":
        top_p = _float_env("GENERATION_TOP_P", 0.9)
    client = get_anthropic_client()
    user_content = build_user_message(base_resume, job_description)
    create_kw: dict = {
        "model": model,
        "max_tokens": 8192,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_content}],
    }
    if top_p is not None:
        create_kw["top_p"] = top_p
    else:
        create_kw["temperature"] = temperature
    try:
        response = client.messages.create(**create_kw)
    except anthropic.AuthenticationError as e:
        raise SystemExit(
            "Anthropic API key invalid (401). Check .env: ANTHROPIC_API_KEY=sk-ant-... "
            "No extra spaces; get a key from https://console.anthropic.com"
        ) from e
    except anthropic.NotFoundError as e:
        raise SystemExit(
            f"Model not found (404): {model}. Set GENERATION_MODEL in .env to an active model, e.g.\n"
            "  GENERATION_MODEL=claude-sonnet-4-5-20250929\n"
            "  or GENERATION_MODEL=claude-haiku-4-5-20251001\n"
            "See https://docs.anthropic.com/en/api/models/list for current models."
        ) from e
    except anthropic.APIConnectionError as e:
        raise SystemExit(
            "Connection failed (network/DNS). Check internet and firewall/proxy."
        ) from e
    text = response.content[0].text
    if not text or not text.strip():
        raise SystemExit("Anthropic API returned empty response.")
    return text.strip()


def main():
    base_dir = Path(__file__).resolve().parent
    base_path = base_dir / "data/base/base1.txt"
    job_path = base_dir / "data/1/jd.txt"
    out_path = base_dir / "data/1/context.txt"

    if not base_path.exists():
        raise SystemExit(f"Missing: {base_path}")
    if not job_path.exists():
        raise SystemExit(f"Missing: {job_path}")

    base_resume = load_file(base_path)
    job_description = load_file(job_path)

    model = os.environ.get("GENERATION_MODEL", DEFAULT_MODEL)
    load_env()
    temp = _float_env("GENERATION_TEMPERATURE", DEFAULT_TEMPERATURE)
    raw_top_p = os.environ.get("GENERATION_TOP_P")
    use_top_p = raw_top_p is not None and raw_top_p.strip() != ""
    if use_top_p:
        top_p_val = _float_env("GENERATION_TOP_P", 0.9)
        print(f"Generating resume with Anthropic model: {model}, top_p: {top_p_val}")
    else:
        print(f"Generating resume with Anthropic model: {model}, temperature: {temp}")
    updated = generate_resume(base_resume, job_description, model=model)

    # Strip any markdown code fence if the model wrapped output
    if updated.startswith("```"):
        lines = updated.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        updated = "\n".join(lines)

    save_file(out_path, updated)
    print("Done. Run: python build_resume_docx.py to create resume.docx")


if __name__ == "__main__":
    main()
