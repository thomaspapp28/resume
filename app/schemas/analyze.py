"""Schemas for job analysis API."""

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    """Request body for POST /api/analyze."""

    job_description: str = Field(..., min_length=1, description="Job description text to analyze")


class AnalyzeResponse(BaseModel):
    """Response from POST /api/analyze."""

    is_remote: bool
    requires_clearance: bool
    is_eligible: bool
    suggested_base: str
    suggested_prompt: str
    available_bases: list[str]
    available_prompts: list[str]
