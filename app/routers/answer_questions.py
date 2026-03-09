"""Screening question answering endpoint."""

import json
import logging

from fastapi import APIRouter, HTTPException

from app.schemas.answer import AnswerQuestionsRequest, AnswerQuestionsResponse

logger = logging.getLogger(__name__)
router = APIRouter()


def _build_profile_summary(profile) -> str:
    """Build a compact text summary of the profile for the prompt."""
    lines = []
    lines.append(f"Name: {profile.full_name or ''}")
    if getattr(profile, "subtitle", None):
        lines.append(f"Title: {profile.subtitle}")
    lines.append(f"Email: {profile.email or ''}")
    lines.append(f"Phone: {profile.phone or ''}")
    lines.append(f"Location: {profile.location or ''}")
    for w in (profile.work_experiences or []):
        cn = w.get("company_name", "")
        jt = w.get("job_title", "")
        df = w.get("date_from", "")
        dt = w.get("date_to", "")
        if cn or jt:
            lines.append(f"Work: {jt} at {cn} ({df} to {dt})")
    for e in (getattr(profile, "educations", None) or []):
        inst = e.get("university") or e.get("institution_name") or ""
        deg = e.get("degree", "")
        field = e.get("field", "")
        if inst or deg:
            lines.append(f"Education: {deg} {field} — {inst}")
    return "\n".join(lines)


@router.post("/answer-questions", response_model=AnswerQuestionsResponse)
def answer_questions(body: AnswerQuestionsRequest):
    """Generate AI answers for job application screening questions."""
    if not body.questions:
        raise HTTPException(status_code=400, detail="No questions provided.")

    profile_text = ""
    if body.profile_id:
        from app.core.database import SessionLocal
        from app.models.profile import Profile
        db = SessionLocal()
        try:
            profile = db.query(Profile).filter(Profile.id == body.profile_id).first()
            if profile:
                profile_text = _build_profile_summary(profile)
        finally:
            db.close()

    questions_block = "\n".join(
        f"{i+1}. {q}" for i, q in enumerate(body.questions)
    )

    prompt = (
        "You are filling out a job application. Answer each screening question concisely and professionally.\n"
        "Use the candidate's profile information to give accurate, truthful answers.\n"
        "For yes/no questions, answer directly then add brief context if helpful.\n"
        "For numeric questions (years of experience, etc.), give a specific number based on the work history.\n"
        "Keep each answer to 1-3 sentences maximum.\n\n"
    )
    if profile_text:
        prompt += f"CANDIDATE PROFILE:\n{profile_text}\n\n"
    if body.job_description:
        prompt += f"JOB DESCRIPTION (for context):\n{body.job_description[:2000]}\n\n"
    prompt += (
        f"SCREENING QUESTIONS:\n{questions_block}\n\n"
        f"Respond with a JSON array of {len(body.questions)} answer strings, "
        "one per question, in the same order. Output ONLY the JSON array, no other text."
    )

    try:
        from app.generation import _get_client, _get_system_prompt
        import os

        client = _get_client()
        response = client.messages.create(
            model=os.environ.get("GENERATION_MODEL", "claude-sonnet-4-20250514"),
            max_tokens=2048,
            system=_get_system_prompt(),
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()

        # Strip markdown fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            lines = lines[1:] if lines[0].startswith("```") else lines
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw = "\n".join(lines).strip()

        answers = json.loads(raw)
        if not isinstance(answers, list):
            raise ValueError("Expected a JSON array")
        # Pad or truncate to match question count
        while len(answers) < len(body.questions):
            answers.append("")
        answers = answers[:len(body.questions)]
        return AnswerQuestionsResponse(answers=answers)

    except json.JSONDecodeError:
        logger.error("Failed to parse AI answer response as JSON: %s", raw[:200])
        raise HTTPException(status_code=500, detail="AI returned invalid JSON for answers.")
    except Exception as e:
        logger.exception("Answer generation failed")
        raise HTTPException(status_code=500, detail=f"Answer generation failed: {e}")
