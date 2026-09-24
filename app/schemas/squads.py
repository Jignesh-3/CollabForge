from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# 1. Member preview for enriched squad responses
class MemberPreview(BaseModel):
    uid: str
    display_name: Optional[str] = None
    github_url: Optional[str] = None
    primary_skills: List[str] = Field(default_factory=list)
    contact_handle: Optional[str] = None


# 2. Base role definition (used for creation / storage)
class RoleSlot(BaseModel):
    role_title: str
    skills_required: List[str] = Field(default_factory=list)
    is_filled: bool = False
    filled_by_user_id: Optional[str] = None


# 3. Enriched role (inherits RoleSlot, adds member_profile & applicant counter)
class EnrichedRoleSlot(RoleSlot):
    member_profile: Optional[MemberPreview] = None
    applicant_count: int = Field(default=0, description="Active pending applications for this slot")


# 4. Create schema (uses basic RoleSlot)
class SquadCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    pitch: str = Field(..., min_length=10)
    hackathon_name: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    roles: List[RoleSlot] = Field(..., min_length=1)
    status: str = Field(default="recruiting", description="'recruiting' or 'full'")


# 5. Response schema (overrides roles with EnrichedRoleSlot)
class SquadResponse(SquadCreate):
    id: str
    leader_id: str
    created_at: Optional[datetime] = None
    roles: List[EnrichedRoleSlot]  # Overrides base roles so member_profile & applicant_count are included


class SquadUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=150)
    pitch: Optional[str] = Field(None, min_length=10)
    hackathon_name: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    status: Optional[str] = None


class MySquadsResponse(BaseModel):
    leading: List[SquadResponse] = []
    joined: List[SquadResponse] = []


# 6. Pagination Envelope
class PaginatedSquadsResponse(BaseModel):
    items: List[SquadResponse]
    total: int = Field(..., description="Total matching squads")
    limit: int = Field(..., description="Items returned per page")
    offset: int = Field(..., description="Starting offset index")
    has_more: bool = Field(..., description="Whether there are more items to fetch")

#Patch and delete

class SquadUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=150)
    pitch: Optional[str] = Field(None, min_length=10)
    hackathon_name: Optional[str] = None
    tech_stack: Optional[List[str]] = None
    status: Optional[str] = Field(None, description="'recruiting' or 'full'")
    roles: Optional[List[RoleSlot]] = Field(None, description="Updated role definitions (cannot shrink filled roles)")

#Roster details

class OperativeRosterMember(BaseModel):
    uid: str
    display_name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    primary_skills: List[str] = []
    github_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    is_leader: bool = False

class SquadRosterResponse(BaseModel):
    squad_id: str
    squad_name: str
    leader_id: str
    pitch: Optional[str] = None
    hackathon: Optional[str] = None
    tech_stack: List[str] = []
    max_members: int
    current_count: int
    open_slots_count: int
    open_roles: List[str] = []
    members: List[OperativeRosterMember]