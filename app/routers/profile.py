"""Profile CRUD endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.profile import Profile
from app.schemas.profile import (
    ProfileCreate,
    ProfileResponse,
    ProfileUpdate,
)

router = APIRouter()


def _profile_to_response(p: Profile) -> ProfileResponse:
    return ProfileResponse(
        id=p.id,
        full_name=p.full_name or "",
        email=p.email or "",
        location=p.location or "",
        phone=p.phone or "",
        work_experiences=p.work_experiences or [],
        educations=getattr(p, "educations", None) or [],
        created_at=p.created_at.isoformat() if p.created_at else "",
        updated_at=p.updated_at.isoformat() if p.updated_at else "",
    )


def _get_educations(p: Profile) -> list:
    return getattr(p, "educations", None) or []


@router.get("/profiles", response_model=list[ProfileResponse])
def list_profiles(db: Session = Depends(get_db)):
    """List all profiles with full details for table display."""
    profiles = db.query(Profile).order_by(Profile.id).all()
    return [_profile_to_response(p) for p in profiles]


@router.get("/profiles/{profile_id}", response_model=ProfileResponse)
def get_profile(profile_id: int, db: Session = Depends(get_db)):
    """Get a single profile by id."""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    educations = _get_educations(profile)
    return ProfileResponse(
        id=profile.id,
        full_name=profile.full_name or "",
        email=profile.email or "",
        location=profile.location or "",
        phone=profile.phone or "",
        work_experiences=profile.work_experiences or [],
        educations=educations,
        created_at=profile.created_at.isoformat() if profile.created_at else "",
        updated_at=profile.updated_at.isoformat() if profile.updated_at else "",
    )


@router.post("/profiles", response_model=ProfileResponse)
def create_profile(body: ProfileCreate, db: Session = Depends(get_db)):
    """Create a new profile."""
    profile = Profile(
        full_name=body.full_name,
        email=body.email,
        location=body.location,
        phone=body.phone,
        work_experiences=[
            {"company_name": w.company_name, "date_from": w.date_from, "date_to": w.date_to}
            for w in body.work_experiences
        ],
        educations=[
            {"institution_name": e.institution_name, "date_from": e.date_from, "date_to": e.date_to}
            for e in body.educations
        ],
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return _profile_to_response(profile)


@router.put("/profiles/{profile_id}", response_model=ProfileResponse)
def update_profile(profile_id: int, body: ProfileUpdate, db: Session = Depends(get_db)):
    """Update a profile by id."""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    if body.full_name is not None:
        profile.full_name = body.full_name
    if body.email is not None:
        profile.email = body.email
    if body.location is not None:
        profile.location = body.location
    if body.phone is not None:
        profile.phone = body.phone
    if body.work_experiences is not None:
        profile.work_experiences = [
            {"company_name": w.company_name, "date_from": w.date_from, "date_to": w.date_to}
            for w in body.work_experiences
        ]
    if body.educations is not None:
        profile.educations = [
            {"institution_name": e.institution_name, "date_from": e.date_from, "date_to": e.date_to}
            for e in body.educations
        ]

    db.commit()
    db.refresh(profile)
    return _profile_to_response(profile)


@router.delete("/profiles/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db)):
    """Delete a profile."""
    profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(profile)
    db.commit()
    return {"ok": True}


