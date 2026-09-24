
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from app.schemas.user import UserProfileUpdate, UserProfileResponse, AchievementCreate, AchievementItem
from app.dependencies import get_current_user
import uuid
from typing import List
from app.firebase import db
from google.cloud import firestore

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

# ==========================================
# CURRENT AUTHENTICATED USER ROUTES (/me)
# ==========================================

@router.get("/me", response_model=UserProfileResponse)
async def get_my_profile(
    current_user: dict = Depends(get_current_user)
):
    """
    Get the profile of the currently authenticated user.
    If no profile document exists yet, returns basic info from the Firebase token.
    """
    uid = current_user["uid"]
    doc_ref = db.collection("users").document(uid)
    doc = doc_ref.get()

    if not doc.exists:
        return UserProfileResponse(
            uid=uid,
            email=current_user.get("email"),
            display_name=current_user.get("name") or current_user.get("email", "").split("@")[0],
            primary_skills=[]
        )

    data = doc.to_dict()
    data["uid"] = uid
    return data


@router.put("/me", response_model=UserProfileResponse)
async def update_my_profile(
    profile_data: UserProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create or update the developer profile for the currently authenticated user.
    Uses merge=True so partial updates do not overwrite unmentioned fields.
    """
    uid = current_user["uid"]
    doc_ref = db.collection("users").document(uid)
    existing_doc = doc_ref.get()

    now = datetime.now(timezone.utc)
    update_payload = profile_data.model_dump(exclude_unset=True)
    update_payload["updated_at"] = now

    if not existing_doc.exists:
        update_payload["uid"] = uid
        update_payload["email"] = current_user.get("email")
        update_payload["created_at"] = now
        if not update_payload.get("display_name"):
            update_payload["display_name"] = current_user.get("name") or current_user.get("email", "").split("@")[0]

    doc_ref.set(update_payload, merge=True)

    saved_doc = doc_ref.get()
    result = saved_doc.to_dict()
    result["uid"] = uid
    return result


# ==========================================
# ACHIEVEMENTS ROUTES (MUST BE BEFORE /{user_id})
# ==========================================

@router.post(
    "/me/achievements", 
    response_model=AchievementItem, 
    status_code=status.HTTP_201_CREATED,
    tags=["Achievements"]
)
async def add_achievement(
    achievement_in: AchievementCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Attach an achievement post with an uploaded image URL to the user's profile.
    """
    uid = current_user["uid"]
    user_ref = db.collection("users").document(uid)

    achievement_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    achievement_data = {
        "id": achievement_id,
        "title": achievement_in.title,
        "description": achievement_in.description,
        "image_url": achievement_in.image_url,
        "project_url": achievement_in.project_url,
        "created_at": now
    }

    user_ref.collection("achievements").document(achievement_id).set(achievement_data)
    return achievement_data


@router.delete(
    "/me/achievements/{achievement_id}", 
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Achievements"]
)
async def delete_achievement(
    achievement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a specific achievement post from the user's profile.
    """
    uid = current_user["uid"]
    achieve_ref = db.collection("users").document(uid).collection("achievements").document(achievement_id)
    
    if not achieve_ref.get().exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Achievement post not found"
        )

    achieve_ref.delete()
    return None


@router.get(
    "/{user_id}/achievements", 
    response_model=List[AchievementItem],
    tags=["Achievements"]
)
async def get_user_achievements(user_id: str):
    """
    Public route: View all visual achievements and posts for any candidate or leader.
    """
    docs = (
        db.collection("users")
        .document(user_id)
        .collection("achievements")
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .stream()
    )

    achievements = [doc.to_dict() for doc in docs]
    return achievements


# ==========================================
# DYNAMIC WILDCARD USER ROUTE (MUST BE LAST)
# ==========================================

@router.get("/{user_id}", response_model=UserProfileResponse)
async def get_user_public_profile(user_id: str):
    """
    Public route: View any developer's profile by their UID.
    Placed at the bottom so it doesn't mask static sub-paths.
    """
    doc_ref = db.collection("users").document(user_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID '{user_id}' not found"
        )

    data = doc.to_dict()
    data["uid"] = user_id
    return data