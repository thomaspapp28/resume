"""Template preview endpoint: renders each template as cached PNG page images.

Uses the latest saved resume.json from a previous generation as sample data.
PNG images are cached to disk — only regenerated when cache is missing.
"""

import base64
import json
import logging
import re
import tempfile
from pathlib import Path

import fitz
from docx2pdf import convert as docx2pdf_convert
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import BASE_TEMPLATES_DIR, DATA_DIR, DATA_RESERVED_DIRS, DEFAULT_BASE
from app.services.docx_builder import build_resume_docx, list_docx_templates

logger = logging.getLogger(__name__)
router = APIRouter()

CACHE_DIR = DATA_DIR / "base" / "_template_previews"


def _find_latest_resume_json() -> dict | None:
    """Find the most recent resume.json from saved generation directories."""
    if not DATA_DIR.exists():
        return None
    candidates: list[tuple[int, Path]] = []
    for d in DATA_DIR.iterdir():
        if not d.is_dir() or d.name in DATA_RESERVED_DIRS:
            continue
        rj = d / "resume.json"
        if rj.exists():
            m = re.match(r"^(\d+)", d.name)
            num = int(m.group(1)) if m else 0
            candidates.append((num, rj))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)
    try:
        return json.loads(candidates[0][1].read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _get_sample_data() -> dict:
    saved = _find_latest_resume_json()
    if saved:
        return saved
    if DEFAULT_BASE.exists():
        try:
            return json.loads(DEFAULT_BASE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _render_pdf_pages(pdf_path: str, dpi: int = 150) -> list[bytes]:
    """Render all PDF pages to PNG bytes using PyMuPDF."""
    pages: list[bytes] = []
    zoom = dpi / 72
    doc = fitz.open(pdf_path)
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        pages.append(pix.tobytes("png"))
    doc.close()
    return pages


def _get_cached_pngs(tid: int) -> list[Path]:
    if not CACHE_DIR.exists():
        return []
    return sorted(CACHE_DIR.glob(f"template_{tid}_page_*.png"))


def _get_cached_docx(tid: int) -> Path | None:
    f = CACHE_DIR / f"template_{tid}.docx"
    return f if f.exists() else None


def _build_and_cache(tid: int, sample: dict) -> tuple[list[bytes], bytes | None]:
    """Build DOCX, convert to PDF, render PNGs, cache everything."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    for old in CACHE_DIR.glob(f"template_{tid}_page_*.png"):
        old.unlink(missing_ok=True)
    cached_docx = CACHE_DIR / f"template_{tid}.docx"
    cached_docx.unlink(missing_ok=True)

    docx_tmp = None
    pdf_tmp = None
    png_pages: list[bytes] = []
    docx_bytes: bytes | None = None

    try:
        with tempfile.NamedTemporaryFile(suffix=".docx", delete=False, dir=str(CACHE_DIR)) as tmp:
            docx_tmp = tmp.name

        build_resume_docx(sample, docx_tmp, template=tid)
        docx_bytes = Path(docx_tmp).read_bytes()
        cached_docx.write_bytes(docx_bytes)

        pdf_tmp = docx_tmp.replace(".docx", ".pdf")
        import pythoncom
        pythoncom.CoInitialize()
        try:
            docx2pdf_convert(docx_tmp, pdf_tmp)
        finally:
            pythoncom.CoUninitialize()

        if Path(pdf_tmp).exists():
            png_pages = _render_pdf_pages(pdf_tmp)
            for i, png_data in enumerate(png_pages):
                (CACHE_DIR / f"template_{tid}_page_{i}.png").write_bytes(png_data)
            logger.info("Template %d: cached %d page(s)", tid, len(png_pages))
        else:
            logger.warning("Template %d: PDF conversion failed", tid)
    except Exception:
        logger.exception("Template %d: build/cache failed", tid)
    finally:
        if docx_tmp:
            Path(docx_tmp).unlink(missing_ok=True)
        if pdf_tmp:
            Path(pdf_tmp).unlink(missing_ok=True)

    return png_pages, docx_bytes


@router.get("/template-preview")
def template_previews():
    """Return cached PNG previews for each template. Build only if cache is missing."""
    templates = list_docx_templates()
    results = []
    sample = None

    for t in templates:
        tid = t["id"]

        cached_pngs = _get_cached_pngs(tid)
        cached_docx = _get_cached_docx(tid)

        if cached_pngs and cached_docx:
            results.append({
                "id": tid,
                "name": t["name"],
                "page_images": [base64.b64encode(f.read_bytes()).decode("ascii") for f in cached_pngs],
                "docx_base64": base64.b64encode(cached_docx.read_bytes()).decode("ascii"),
            })
            continue

        if sample is None:
            sample = _get_sample_data()
        if not sample:
            results.append({"id": tid, "name": t["name"], "page_images": [], "docx_base64": None})
            continue

        png_pages, docx_bytes = _build_and_cache(tid, sample)
        results.append({
            "id": tid,
            "name": t["name"],
            "page_images": [base64.b64encode(p).decode("ascii") for p in png_pages],
            "docx_base64": base64.b64encode(docx_bytes).decode("ascii") if docx_bytes else None,
        })

    return JSONResponse(content=results)


@router.post("/template-preview/refresh")
def refresh_previews():
    """Clear all cached previews and regenerate from latest saved resume."""
    if CACHE_DIR.exists():
        for f in CACHE_DIR.iterdir():
            f.unlink(missing_ok=True)
    return template_previews()
