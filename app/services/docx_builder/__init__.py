"""DOCX resume builder package. Five self-contained template modules."""

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


def build_resume_docx(context_path: str, output_path: str, template: int = 1) -> None:
    """Create a Word resume from context text.
    template: 1-5 (1=Classic, 2=Ryan Jackson, 3=Sean Greeley, 4=Corey Crandal, 5=Nelson Borges)
    """
    if template not in _BUILDERS:
        template = 1
    _BUILDERS[template](context_path, output_path)


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
