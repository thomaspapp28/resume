"""Job analysis endpoint."""

from fastapi import APIRouter

from app.core.config import get_prompt_for_job, list_available_bases, list_available_prompts
from app.job_analyzer import analyze_job
from app.schemas.analyze import AnalyzeRequest, AnalyzeResponse

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(body: AnalyzeRequest):
    """Analyze job description: remote?, clearance?, tech stack, suggested base template."""
    jd = body.job_description.strip()
    analysis = analyze_job(jd)
    available = list_available_bases()
    suggested_base = available[0] if available else "base1.txt"
    prompts = list_available_prompts()
    suggested_prompt = get_prompt_for_job(jd)
    if suggested_prompt not in prompts:
        suggested_prompt = "default"
    return AnalyzeResponse(
        is_remote=analysis.is_remote,
        requires_clearance=analysis.requires_clearance,
        is_eligible=analysis.is_eligible,
        suggested_base=suggested_base,
        suggested_prompt=suggested_prompt,
        available_bases=available or ["base1.txt"],
        available_prompts=prompts,
    )
