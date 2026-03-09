"""Options endpoint for base templates, prompts, and docx formats."""

from fastapi import APIRouter

from app.core.config import list_available_bases, list_available_prompts
from app.services.docx_builder import list_docx_templates

router = APIRouter()


@router.get("/options")
def get_options():
    """Return available base templates, prompts, and docx format templates."""
    bases = list_available_bases()
    prompts = list_available_prompts()
    docx_templates = list_docx_templates()
    return {
        "available_bases": bases if bases else ["Full_Stack.json"],
        "available_prompts": prompts,
        "docx_templates": docx_templates,
    }
