"""
Flask API: paste job description → get tailored resume (text + .docx download).
For each job description, saves to its own directory:
  data/<unique_number>_<company_name>/jd.txt, context.txt, resume.docx
Run: python app.py
Open: http://127.0.0.1:5000
"""

import base64
import re
import tempfile
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

app = Flask(__name__, static_folder="static", static_url_path="")
CORS(app)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
BASE_RESUME_PATH = DATA_DIR / "base" / "base1.txt"


def _next_unique_number() -> int:
    """Return next unique number from existing data subdirectories (one dir per JD)."""
    numbers = []
    if not DATA_DIR.exists():
        return 1
    for p in DATA_DIR.iterdir():
        if not p.is_dir() or p.name == "base":
            continue
        if p.name.isdigit():
            numbers.append(int(p.name))
        else:
            m = re.match(r"^(\d+)_", p.name)
            if m:
                numbers.append(int(m.group(1)))
    return max(numbers, default=0) + 1


def _extract_company_name(job_description: str) -> str:
    """Extract company name from job description for use in filename."""
    jd = job_description.strip()
    # "At Company Name," or "At Company Name."
    m = re.search(r"\bAt\s+([^,.\n]+?)(?:[,.\s]|$)", jd, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # "Join Company Name" or "Join us at Company Name"
    m = re.search(r"Join\s+(?:us\s+at\s+)?([^,.\n!?]+?)(?:[,.\s!?]|$)", jd, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    # "Company Name is hiring" or "Company Name -"
    m = re.search(r"^([A-Z][^-\n]{2,50}?)\s+is\s+(?:hiring|seeking)", jd, re.IGNORECASE | re.MULTILINE)
    if m:
        return m.group(1).strip()
    # First line that looks like a title (short, no bullet)
    first_line = jd.split("\n")[0].strip()
    if first_line and len(first_line) < 80 and not first_line.startswith(("•", "-", "*")):
        return first_line
    return "Company"


def _sanitize_filename(name: str) -> str:
    """Sanitize company name for use in filename."""
    s = re.sub(r"[^\w\s-]", "", name)
    s = re.sub(r"[-\s]+", "_", s).strip("_")
    return s[:60] if s else "Company"


def _resume_name_to_file_base(resume_text: str) -> str:
    """Extract 'Firstname_Lastname' from resume first line for use in resume.docx/pdf filename."""
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


def load_base_resume() -> str:
    if not BASE_RESUME_PATH.exists():
        raise FileNotFoundError(f"Base resume not found: {BASE_RESUME_PATH}")
    return BASE_RESUME_PATH.read_text(encoding="utf-8").strip()


@app.route("/")
def index():
    return send_file(BASE_DIR / "static" / "index.html")


@app.route("/api/generate", methods=["POST"])
def generate():
    """Accept job description JSON; return resume text and docx as base64."""
    data = request.get_json() or {}
    job_description = (data.get("job_description") or "").strip()
    if not job_description:
        return jsonify({"error": "job_description is required and cannot be empty"}), 400

    try:
        base_resume = load_base_resume()
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 500

    try:
        from generation import generate_resume
    except ImportError:
        return jsonify({"error": "generation module not found"}), 500

    try:
        resume_text = generate_resume(base_resume, job_description)
    except SystemExit as e:
        return jsonify({"error": str(e)}), 500
    except ImportError as e:
        return jsonify({
            "error": f"Missing dependency: {e}. Install with: pip install -r requirements.txt (run the app using the project's .venv Python)."
        }), 500
    except Exception as e:
        return jsonify({"error": f"Generation failed: {e}"}), 500

    # Strip markdown code fence if present
    if resume_text.startswith("```"):
        lines = resume_text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        resume_text = "\n".join(lines)

    # Save to a directory per job: data/<unique_number>_<company_name>/
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    unique_num = _next_unique_number()
    company = _sanitize_filename(_extract_company_name(job_description))
    dir_name = f"{unique_num}_{company}"
    job_dir = DATA_DIR / dir_name
    job_dir.mkdir(parents=True, exist_ok=True)

    jd_path = job_dir / "jd.txt"
    context_path = job_dir / "context.txt"
    jd_path.write_text(job_description, encoding="utf-8")
    context_path.write_text(resume_text, encoding="utf-8")
    saved_files = ["jd.txt", "context.txt"]

    resume_file_base = _resume_name_to_file_base(resume_text)
    docx_filename = f"{resume_file_base}.docx"
    pdf_filename = f"{resume_file_base}.pdf"
    docx_base64 = None
    pdf_base64 = None
    docx_path = job_dir / docx_filename
    pdf_path = job_dir / pdf_filename
    try:
        from build_resume_docx import build_resume_docx
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f_ctx:
            f_ctx.write(resume_text)
            ctx_path = f_ctx.name
        try:
            build_resume_docx(ctx_path, str(docx_path))
            docx_base64 = base64.b64encode(docx_path.read_bytes()).decode("ascii")
            saved_files.append(docx_filename)
        finally:
            Path(ctx_path).unlink(missing_ok=True)
    except Exception:
        docx_base64 = None  # still return text and saved txt files

    # Convert Word to PDF (Windows: requires Microsoft Word installed; docx2pdf uses it)
    try:
        from docx2pdf import convert
        convert(str(docx_path), str(pdf_path))
        if pdf_path.exists():
            pdf_base64 = base64.b64encode(pdf_path.read_bytes()).decode("ascii")
            saved_files.append(pdf_filename)
    except Exception:
        pdf_base64 = None

    return jsonify({
        "resume_text": resume_text,
        "docx_base64": docx_base64,
        "pdf_base64": pdf_base64,
        "docx_filename": docx_filename,
        "pdf_filename": pdf_filename,
        "saved_dir": dir_name,
        "saved_files": saved_files,
    })


def main():
    if not BASE_RESUME_PATH.exists():
        print(f"Warning: Base resume not found at {BASE_RESUME_PATH}")
    try:
        import anthropic  # noqa: F401
    except ImportError:
        print("Error: 'anthropic' not installed. Install dependencies with:")
        print("  pip install -r requirements.txt")
        print("Or run using the project's venv:  .venv\\Scripts\\python app.py")
        raise SystemExit(1)
    print("Open http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)


if __name__ == "__main__":
    main()
