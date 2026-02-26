"""Resume generation and file persistence logic."""

import base64
import re
import tempfile
from pathlib import Path

from app.core.config import BASE_TEMPLATES_DIR, DATA_DIR, DATA_RESERVED_DIRS
from app.job_analyzer import analyze_job  # for remote/clearance only


def _next_unique_number() -> int:
    """Return next unique number from existing data subdirectories (one dir per JD)."""
    numbers = []
    if not DATA_DIR.exists():
        return 1
    for p in DATA_DIR.iterdir():
        if not p.is_dir() or p.name in DATA_RESERVED_DIRS:
            continue
        if p.name.isdigit():
            numbers.append(int(p.name))
        else:
            m = re.match(r"^(\d+)_", p.name)
            if m:
                numbers.append(int(m.group(1)))
    return max(numbers, default=0) + 1


def _extract_company_name(job_description: str) -> str:
    """Extract company name from job description for use in directory name."""
    jd = job_description.strip()
    m = re.search(r"\bAt\s+([^,.\n]+?)(?:[,.\s]|$)", jd, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"Join\s+(?:us\s+at\s+)?([^,.\n!?]+?)(?:[,.\s!?]|$)", jd, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(
        r"^([A-Z][^-\n]{2,50}?)\s+is\s+(?:hiring|seeking)",
        jd,
        re.IGNORECASE | re.MULTILINE,
    )
    if m:
        return m.group(1).strip()
    first_line = jd.split("\n")[0].strip()
    if first_line and len(first_line) < 80 and not first_line.startswith(("•", "-", "*")):
        return first_line
    return "Company"


def _sanitize_filename(name: str) -> str:
    """Sanitize company name for use in directory/filename."""
    s = re.sub(r"[^\w\s-]", "", name)
    s = re.sub(r"[-\s]+", "_", s).strip("_")
    return s[:60] if s else "Company"


def _resume_name_to_file_base(resume_text: str) -> str:
    """Extract Firstname_Lastname from resume first line for resume.docx/pdf filename."""
    first_line = (resume_text or "").strip().split("\n")[0].strip()
    parts = first_line.split()
    if not parts:
        return "resume"
    if len(parts) == 1:
        safe = re.sub(r"[^\w-]", "", parts[0])[:40]
        return safe or "resume"
    first_name = re.sub(r"[^\w-]", "", parts[0])[:30]
    last_name = re.sub(r"[^\w-]", "", parts[-1])[:30]
    return f"{first_name}_{last_name}_resume" if (first_name or last_name) else "resume"


def _strip_markdown_fence(text: str) -> str:
    """Remove markdown code fence if present around resume text."""
    if not text.startswith("```"):
        return text
    lines = text.split("\n")
    if lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines)


def _load_base_resume_from_path(path: Path) -> str:
    """Load base resume text from the given path."""
    if not path.exists():
        raise FileNotFoundError(f"Base resume not found: {path}")
    return path.read_text(encoding="utf-8").strip()


def _build_profile_context(profile: dict) -> str:
    """Build a profile context string for the generation prompt."""
    lines = ["CANDIDATE PROFILE (use this person's information in the resume):"]
    lines.append(f"- Name: {profile.get('full_name', '')}")
    lines.append(f"- Email: {profile.get('email', '')}")
    lines.append(f"- Location: {profile.get('location', '')}")
    lines.append(f"- Phone: {profile.get('phone', '')}")
    def _fmt_date(s: str) -> str:
        """Format YYYY-MM to 'Mon YYYY' or 'Present'."""
        if not s or s.lower() == "present":
            return "Present"
        if len(s) >= 7:
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            try:
                y, m = s[:4], int(s[5:7])
                return f"{months[m - 1]} {y}" if 1 <= m <= 12 else s
            except (ValueError, IndexError):
                pass
        return s

    work = profile.get("work_experiences") or []
    if work:
        lines.append("- Work experience:")
        for w in work:
            cn = w.get("company_name", "").strip()
            df = _fmt_date(w.get("date_from", ""))
            dt = _fmt_date(w.get("date_to", ""))
            if cn:
                lines.append(f"  - {cn}: {df} to {dt}")
    edu = profile.get("educations") or []
    if edu:
        lines.append("- Education:")
        for e in edu:
            inst = e.get("institution_name", "").strip()
            df = _fmt_date(e.get("date_from", ""))
            dt = _fmt_date(e.get("date_to", ""))
            if inst:
                lines.append(f"  - {inst}: {df} to {dt}")
    return "\n".join(lines)


def generate_and_save_resume(
    job_description: str,
    base_template: str | None = None,
    prompt_name: str | None = None,
    force: bool = False,
    profile_id: int | None = None,
    docx_template: int = 1,
) -> dict:
    """
    Generate tailored resume from job description, save to data dir, return response dict.
    - base_template: optional filename (e.g. base1.txt); if omitted, uses base1.txt.
    - prompt_name: optional prompt name (e.g. full_stack_backend, ai_ml); if omitted, uses default.
    - force: if True, skip eligibility check (remote, no clearance).
    - profile_id: optional profile (person) to use; if provided, profile data is injected into the prompt.
    """
    job_description = job_description.strip()

    analysis = analyze_job(job_description)
    if not force and not analysis.is_eligible:
        reasons = []
        if not analysis.is_remote:
            reasons.append("not remote")
        if analysis.requires_clearance:
            reasons.append("requires clearance")
        raise ValueError(
            f"Job is not eligible: {'; '.join(reasons)}. "
            "Only remote positions with no security clearance are processed. "
            "Use force=true to override."
        )

    from app.core.config import DEFAULT_BASE, load_prompt
    from app.core.database import SessionLocal
    from app.generation import generate_resume
    from app.models.profile import Profile

    base_path = (
        BASE_TEMPLATES_DIR / base_template
        if base_template and (BASE_TEMPLATES_DIR / base_template).exists()
        else BASE_TEMPLATES_DIR / "base1.txt" if (BASE_TEMPLATES_DIR / "base1.txt").exists() else DEFAULT_BASE
    )
    base_resume = _load_base_resume_from_path(base_path)
    instruction_prompt = load_prompt(prompt_name or "default")

    if profile_id:
        db = SessionLocal()
        try:
            profile = db.query(Profile).filter(Profile.id == profile_id).first()
            if profile:
                profile_dict = {
                    "full_name": profile.full_name,
                    "email": profile.email,
                    "location": profile.location,
                    "phone": profile.phone,
                    "work_experiences": profile.work_experiences or [],
                    "educations": getattr(profile, "educations", None) or [],
                }
                profile_context = _build_profile_context(profile_dict)
                instruction_prompt = f"{profile_context}\n\n{instruction_prompt}"
        finally:
            db.close()

    resume_text = generate_resume(base_resume, job_description, instruction_prompt=instruction_prompt)
    resume_text = _strip_markdown_fence(resume_text)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    unique_num = _next_unique_number()
    company = _sanitize_filename(_extract_company_name(job_description))
    dir_name = f"{unique_num}_{company}"
    job_dir = DATA_DIR / dir_name
    job_dir.mkdir(parents=True, exist_ok=True)

    (job_dir / "jd.txt").write_text(job_description, encoding="utf-8")
    (job_dir / "context.txt").write_text(resume_text, encoding="utf-8")
    saved_files: list[str] = ["jd.txt", "context.txt"]

    resume_file_base = _resume_name_to_file_base(resume_text)
    docx_filename = f"{resume_file_base}.docx"
    pdf_filename = f"{resume_file_base}.pdf"
    docx_base64 = None
    pdf_base64 = None
    docx_path = job_dir / docx_filename
    pdf_path = job_dir / pdf_filename

    try:
        from app.services.docx_builder import build_resume_docx

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as f_ctx:
            f_ctx.write(resume_text)
            ctx_path = f_ctx.name
        try:
            build_resume_docx(ctx_path, str(docx_path), template=docx_template)
            docx_base64 = base64.b64encode(docx_path.read_bytes()).decode("ascii")
            saved_files.append(docx_filename)
        finally:
            Path(ctx_path).unlink(missing_ok=True)
    except Exception:
        docx_base64 = None

    try:
        from docx2pdf import convert

        convert(str(docx_path), str(pdf_path))
        if pdf_path.exists():
            pdf_base64 = base64.b64encode(pdf_path.read_bytes()).decode("ascii")
            saved_files.append(pdf_filename)
    except Exception:
        pdf_base64 = None

    return {
        "resume_text": resume_text,
        "docx_base64": docx_base64,
        "pdf_base64": pdf_base64,
        "docx_filename": docx_filename,
        "pdf_filename": pdf_filename,
        "saved_dir": dir_name,
        "saved_files": saved_files,
        "base_used": base_path.name,
        "prompt_name": prompt_name or "default",
        "is_remote": analysis.is_remote,
        "requires_clearance": analysis.requires_clearance,
    }


