from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl


# --- Base User Profile Schemas ---
class UserProfileBase(BaseModel):
    display_name: Optional[str] = Field(None, example="Alex Chen")
    bio: Optional[str] = Field(None, max_length=300, example="Full-stack builder passionate about AI tooling.")
    github_url: Optional[str] = Field(None, example="https://github.com/alexchen")
    portfolio_url: Optional[str] = Field(None, example="https://alexchen.dev")
    primary_skills: List[str] = Field(default_factory=list, example=["Python", "FastAPI", "React"])
    contact_handle: Optional[str] = Field(None, example="@alexchen:discord")


class UserProfileUpdate(UserProfileBase):
    pass


# --- Posts and Achievements Schemas ---
class AchievementCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100, description="Name of the hackathon or project win")
    description: str = Field(..., min_length=10, max_length=500, description="Brief breakdown of what you built")
    image_url: str = Field(..., description="Firebase Storage public download URL")
    project_url: Optional[str] = Field(None, description="GitHub repository or live demo link")


class AchievementItem(AchievementCreate):
    id: str
    created_at: datetime


# --- Response Schema (Placed after AchievementItem) ---
class UserProfileResponse(UserProfileBase):
    uid: str
    email: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    achievements: List[AchievementItem] = Field(default_factory=list)