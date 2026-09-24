from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from app.schemas.squads import MemberPreview

# Allowed application lifecycle states
ApplicationStatus = Literal[
    "pending",
    "accepted",
    "rejected",
    "resigned",
    "removed",
    "withdrawn",
]


class ApplicationCreate(BaseModel):
    squad_id: str = Field(..., example="squad_doc_id_123")
    role_index: int = Field(..., ge=0, example=0)
    pitch: str = Field(
        ...,
        min_length=10,
        max_length=500,
        example="I've built 3 hackathon backends with FastAPI and Firestore.",
    )
    proof_url: Optional[str] = Field(
        None, example="https://github.com/username/project"
    )  # <-- Added field


class ApplicationResponse(BaseModel):
    id: str
    squad_id: str
    role_index: int
    applicant_id: str
    applicant_email: Optional[str] = None
    pitch: str
    proof_url: Optional[str] = None  # <-- Added field
    status: ApplicationStatus = "pending"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# Contextual preview for applicant dashboard
class SquadContextPreview(BaseModel):
    squad_id: str
    squad_title: str
    hackathon_name: Optional[str] = None
    role_title: str


class MyApplicationsResponse(BaseModel):
    id: str
    squad_id: str
    role_index: int
    applicant_id: str
    pitch: str
    proof_url: Optional[str] = None  # <-- Added field
    status: ApplicationStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    squad_context: Optional[SquadContextPreview] = None


# Squad Leader Review Item
class ApplicantReviewItem(BaseModel):
    id: str
    squad_id: str
    role_index: int
    role_title: Optional[str] = None
    applicant_id: str
    applicant_email: Optional[str] = None
    pitch: str
    proof_url: Optional[str] = None  # <-- Added field
    status: ApplicationStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    applicant_profile: Optional[MemberPreview] = None