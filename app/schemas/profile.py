"""Pydantic schemas for profile API."""

from pydantic import BaseModel, Field, model_validator


class WorkExperience(BaseModel):
    company_name: str = ""
    job_title: str = ""
    date_from: str = ""  # YYYY-MM e.g. "2019-03"
    date_to: str = ""  # YYYY-MM e.g. "2022-11"


class Education(BaseModel):
    university: str = ""  # Same as education institution (university / school name)
    degree: str = ""
    field: str = ""  # Field of study
    date_from: str = ""  # YYYY-MM
    date_to: str = ""  # YYYY-MM

    @model_validator(mode="before")
    @classmethod
    def accept_institution_name(cls, data):
        """Accept old 'institution_name' from client and map to university."""
        if isinstance(data, dict) and "institution_name" in data and not data.get("university"):
            data = dict(data)
            data["university"] = data.get("institution_name", "")
        return data


class ProfileCreate(BaseModel):
    """Request body for POST /api/profiles."""

    full_name: str = ""
    subtitle: str = ""  # Professional title
    email: str = ""
    location: str = ""
    phone: str = ""
    work_experiences: list[WorkExperience] = Field(default_factory=list)
    educations: list[Education] = Field(default_factory=list)


class ProfileUpdate(BaseModel):
    """Request body for PUT /api/profiles/{id}."""

    full_name: str | None = Field(None, max_length=200)
    subtitle: str | None = Field(None, max_length=300)
    email: str | None = Field(None, max_length=200)
    location: str | None = Field(None, max_length=200)
    phone: str | None = Field(None, max_length=50)
    work_experiences: list[WorkExperience] | None = None
    educations: list[Education] | None = None


class ProfileResponse(BaseModel):
    """Response for profile."""

    id: int
    full_name: str
    subtitle: str
    email: str
    location: str
    phone: str
    work_experiences: list[dict]
    educations: list[dict]
    created_at: str
    updated_at: str


class ProfileSummary(BaseModel):
    """Minimal profile for list/dropdown."""

    id: int
    full_name: str
    subtitle: str = ""
