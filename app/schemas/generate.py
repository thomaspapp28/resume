"""Schemas for resume generation API."""

from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    """Request body for POST /api/generate."""

    job_description: str = Field(
        ...,
        min_length=1,
        description="Job description text to tailor the resume to.",
    )
    base_template: str | None = Field(
        None,
        description="Base template filename (e.g. Full_Stack.json). If omitted, uses Full_Stack.json.",
    )
    prompt_name: str | None = Field(
        None,
        description="Prompt name (e.g. full_stack_backend, ai_ml, default). If omitted, uses default.",
    )
    force: bool = Field(
        False,
        description="If True, skip eligibility check (remote, no clearance).",
    )
    profile_id: int | None = Field(
        None,
        description="Profile (person) to use for resume. If omitted, uses base template as-is.",
    )
    docx_template: int | None = Field(
        None,
        ge=1,
        le=5,
        description="DOCX format template 1-5. Default 1.",
    )


class GenerateResponse(BaseModel):
    """Response from POST /api/generate."""

    resume_text: str
    docx_base64: str | None = None
    pdf_base64: str | None = None
    docx_filename: str
    pdf_filename: str
    saved_dir: str
    saved_files: list[str]
    base_used: str | None = None
    prompt_name: str | None = None
    is_remote: bool | None = None
    requires_clearance: bool | None = None
