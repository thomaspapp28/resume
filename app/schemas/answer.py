"""Schemas for screening question answering API."""

from pydantic import BaseModel, Field


class AnswerQuestionsRequest(BaseModel):
    """Request body for POST /api/answer-questions."""

    questions: list[str] = Field(
        ..., min_length=1, description="List of screening questions to answer."
    )
    job_description: str = Field(
        "", description="Job description for context."
    )
    profile_id: int | None = Field(
        None, description="Profile ID to base answers on."
    )


class AnswerQuestionsResponse(BaseModel):
    """Response from POST /api/answer-questions."""

    answers: list[str]
