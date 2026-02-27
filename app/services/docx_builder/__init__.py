"""DOCX resume builder package. Five self-contained template modules."""

import tempfile
from pathlib import Path

from app.schemas.resume import json_to_text

from app.services.docx_builder.template1 import build as build_1, CONFIG as CONFIG_1
from app.services.docx_builder.template2 import build as build_2, CONFIG as CONFIG_2
from app.services.docx_builder.template3 import build as build_3, CONFIG as CONFIG_3
from app.services.docx_builder.template4 import build as build_4, CONFIG as CONFIG_4
from app.services.docx_builder.template5 import build as build_5, CONFIG as CONFIG_5

_BUILDERS = {
    1: build_1,
    2: build_2,
    3: build_3,
    4: build_4,
    5: build_5,
}

_TEMPLATES = {
    1: CONFIG_1,
    2: CONFIG_2,
    3: CONFIG_3,
    4: CONFIG_4,
    5: CONFIG_5,
}


def build_resume_docx(
    context_path: str | Path | dict,
    output_path: str | Path,
    template: int = 1,
) -> None:
    """Create a Word resume from context.
    context_path: path to .txt file, or resume dict (JSON structure).
    template: 1-5
    """
    if template not in _BUILDERS:
        template = 1

    if isinstance(context_path, dict):
        text = json_to_text(context_path)
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".txt", delete=False, encoding="utf-8"
        ) as f:
            f.write(text)
            ctx_path = f.name
        try:
            _BUILDERS[template](ctx_path, str(output_path))
        finally:
            Path(ctx_path).unlink(missing_ok=True)
    else:
        _BUILDERS[template](str(context_path), str(output_path))


def list_docx_templates() -> list[dict]:
    """Return available docx template options for API/frontend."""
    return [{"id": k, "name": v["name"]} for k, v in sorted(_TEMPLATES.items())]


def main():
    """CLI: build data/1/resume.docx from data/1/context.txt. Usage: python -m app.services.docx_builder [template 1-5]"""
    import sys
    from app.core.config import BASE_DIR

    template = 1
    if len(sys.argv) > 1:
        try:
            template = max(1, min(5, int(sys.argv[1])))
        except ValueError:
            pass
    context_path = BASE_DIR / "data" / "1" / "context.txt"
    output_path = BASE_DIR / "data" / "1" / f"resume_template{template}.docx"
    if not context_path.exists():
        print(f"Error: {context_path} not found.")
        return
    build_resume_docx(str(context_path), str(output_path), template=template)
    print(f"Saved: {output_path} (template {template})")


if __name__ == "__main__":
    main()
