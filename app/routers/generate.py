"""Resume generation endpoint."""

from fastapi import APIRouter, HTTPException

from app.schemas.generate import GenerateRequest, GenerateResponse
from app.services.resume_service import generate_and_save_resume

router = APIRouter()


@router.post("/generate", response_model=GenerateResponse)
def generate(body: GenerateRequest):
    """
    Generate a tailored resume from the given job description.
    Saves jd.txt, context.txt, and resume .docx/.pdf under data/<number>_<company>/.
    """
    job_description = body.job_description.strip()
    if not job_description:
        raise HTTPException(
            status_code=400,
            detail="job_description is required and cannot be empty",
        )

    try:
        result = generate_and_save_resume(
            job_description,
            base_template=body.base_template,
            prompt_name=body.prompt_name,
            force=body.force,
            profile_id=body.profile_id,
            docx_template=body.docx_template or 1,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ImportError as e:
        if "generation" in str(e):
            raise HTTPException(
                status_code=500,
                detail="generation module not found",
            ) from e
        raise HTTPException(
            status_code=500,
            detail=f"Missing dependency: {e}. Install with: pip install -r requirements.txt",
        ) from e
    except SystemExit as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Generation failed: {e}",
        ) from e

    return GenerateResponse(**result)
