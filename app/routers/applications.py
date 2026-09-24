from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime, timezone
from typing import List, Optional, Literal
from app.schemas.application import ApplicationCreate, ApplicationResponse, ApplicantReviewItem
from app.firebase import db
from app.dependencies import get_current_user
from google.cloud.firestore_v1 import ArrayUnion

router = APIRouter(
    prefix="/applications",
    tags=["Applications"]
)

@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_for_role(
    app_data: ApplicationCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Applicant submits a join request for a specific role slot in a squad.
    Guards:
      - Squad must exist.
      - Role index must be valid.
      - Role must not already be filled.
      - Cannot apply to your own squad if you are the leader.
      - Cannot submit duplicate pending applications for the same role.
    """
    applicant_id = current_user["uid"]
    squad_ref = db.collection("squads").document(app_data.squad_id)
    squad_doc = squad_ref.get()

    if not squad_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad '{app_data.squad_id}' not found"
        )

    squad = squad_doc.to_dict()
    roles = squad.get("roles", [])

    if app_data.role_index < 0 or app_data.role_index >= len(roles):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role index {app_data.role_index} out of bounds"
        )

    target_role = roles[app_data.role_index]
    if target_role.get("is_filled", False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This role has already been filled"
        )

    # Check for duplicate pending application
    existing_apps = (
        db.collection("applications")
        .where("squad_id", "==", app_data.squad_id)
        .where("role_index", "==", app_data.role_index)
        .where("applicant_id", "==", applicant_id)
        .where("status", "==", "pending")
        .stream()
    )
    if any(existing_apps):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a pending application for this role"
        )

    now = datetime.now(timezone.utc)
    new_app = {
        "squad_id": app_data.squad_id,
        "role_index": app_data.role_index,
        "applicant_id": applicant_id,
        "applicant_email": current_user.get("email"),
        "pitch": app_data.pitch,
        "proof_url": app_data.proof_url,  # <--- Added to persist proof link from payload
        "status": "pending",
        "created_at": now,
        "updated_at": now
    }

    _, doc_ref = db.collection("applications").add(new_app)
    new_app["id"] = doc_ref.id
    return new_app

@router.get("/squad/{squad_id}", response_model=List[ApplicantReviewItem])
async def list_squad_applications(
    squad_id: str,
    role_index: Optional[int] = Query(
        None, ge=0, description="Filter applicants for a specific role slot"
    ),
    status_filter: Optional[
        Literal[
            "pending",
            "accepted",
            "rejected",
            "resigned",
            "removed",
            "withdrawn",
        ]
    ] = Query(
        "pending", description="Filter by application status (default: 'pending')"
    ),
    current_user: dict = Depends(get_current_user),
):
    """Squad leader views all applications for their squad.

    Enforces authorization: Only the squad creator (leader_id) can view
    applications. Enriches each application with candidate profile details,
    readable username/handle, proof link, and role title.
    """
    squad_doc = db.collection("squads").document(squad_id).get()
    if not squad_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad '{squad_id}' not found",
        )

    squad_data = squad_doc.to_dict()
    if squad_data.get("leader_id") != current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the squad leader can view applications",
        )

    roles = squad_data.get("roles", [])

    # Query applications for this squad
    query = db.collection("applications").where("squad_id", "==", squad_id)
    if status_filter:
        query = query.where("status", "==", status_filter)
    if role_index is not None:
        query = query.where("role_index", "==", role_index)

    # Local user cache to prevent duplicate Firestore lookups
    user_cache = {}
    review_items = []

    for doc in query.stream():
        app_data = doc.to_dict()
        app_data["id"] = doc.id

        # Explicitly ensure proof_url is bound (defaults to None if missing in legacy records)
        app_data["proof_url"] = app_data.get("proof_url")

        # 1. Resolve readable role title
        r_idx = app_data.get("role_index", 0)
        app_data["role_title"] = (
            roles[r_idx]["role_title"]
            if r_idx < len(roles)
            else f"Role #{r_idx}"
        )

        # 2. Hydrate applicant public profile with clean handle fallbacks
        applicant_uid = app_data.get("applicant_id")
        applicant_email = app_data.get("applicant_email")
        email_handle = (
            applicant_email.split("@")[0] if applicant_email else None
        )

        if applicant_uid and applicant_uid not in user_cache:
            user_doc = db.collection("users").document(applicant_uid).get()
            if user_doc.exists:
                u_info = user_doc.to_dict()
                display_name = (
                    u_info.get("display_name") or email_handle or "Engineer"
                )
                contact_handle = (
                    u_info.get("contact_handle") or email_handle or "dev"
                )

                user_cache[applicant_uid] = {
                    "uid": applicant_uid,
                    "display_name": display_name,
                    "github_url": u_info.get("github_url"),
                    "primary_skills": u_info.get("primary_skills", []),
                    "contact_handle": contact_handle,
                }
            else:
                user_cache[applicant_uid] = {
                    "uid": applicant_uid,
                    "display_name": email_handle or "Engineer",
                    "github_url": None,
                    "primary_skills": [],
                    "contact_handle": email_handle or "dev",
                }

        app_data["applicant_profile"] = user_cache.get(applicant_uid)
        review_items.append(app_data)

    # Sort newest first
    review_items.sort(
        key=lambda x: str(x.get("created_at") or ""), reverse=True
    )

    return review_items

#MyApplicationResponse

from app.schemas.application import (
    ApplicationCreate, 
    ApplicationResponse, 
    MyApplicationsResponse, 
    SquadContextPreview
)


@router.get("/me", response_model=List[MyApplicationsResponse])
async def get_my_applications(
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Applicant dashboard: Fetch all applications submitted by the current user.
    Optionally filter by status: 'pending', 'accepted', 'rejected'.
    Enriches results with squad and role titles.
    """
    user_id = current_user["uid"]

    query = db.collection("applications").where("applicant_id", "==", user_id)
    if status_filter:
        query = query.where("status", "==", status_filter)

    applications_docs = query.stream()

    results = []
    for doc in applications_docs:
        app_data = doc.to_dict()
        app_data["id"] = doc.id

        # Hydrate squad details for the applicant
        squad_id = app_data.get("squad_id")
        role_index = app_data.get("role_index", 0)

        squad_context = None
        if squad_id:
            squad_doc = db.collection("squads").document(squad_id).get()
            if squad_doc.exists:
                s_data = squad_doc.to_dict()
                roles = s_data.get("roles", [])
                role_title = roles[role_index].get("role_title", "Unknown Role") if role_index < len(roles) else "Unknown Role"

                squad_context = SquadContextPreview(
                    squad_id=squad_id,
                    squad_title=s_data.get("title", "Untitled Squad"),
                    hackathon_name=s_data.get("hackathon_name"),
                    role_title=role_title
                )

        app_data["squad_context"] = squad_context
        results.append(app_data)

    return results


@router.post("/{application_id}/accept", response_model=ApplicationResponse)
async def accept_application(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Squad leader accepts an applicant.
    Atomically:
      1. Updates application status to 'accepted'.
      2. Claims the squad role (is_filled=True, filled_by_user_id=applicant_id).
      3. Recalculates squad recruiting vs full status.
      4. Auto-rejects other pending applications for that exact role slot.
    """
    app_ref = db.collection("applications").document(application_id)
    app_doc = app_ref.get()

    if not app_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found"
        )

    application = app_doc.to_dict()
    if application.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept an application that is already '{application.get('status')}'"
        )

    squad_id = application["squad_id"]
    role_idx = application["role_index"]
    applicant_id = application["applicant_id"]

    squad_ref = db.collection("squads").document(squad_id)
    squad_doc = squad_ref.get()

    if not squad_doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated squad not found")

    squad = squad_doc.to_dict()

    # Authorization Check
    if squad.get("leader_id") != current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the squad leader can accept applications"
        )

    roles = squad.get("roles", [])
    if roles[role_idx].get("is_filled", False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This role slot has already been filled by another member"
        )

    now = datetime.now(timezone.utc)

    # 1. Fill the role on the squad
    roles[role_idx]["is_filled"] = True
    roles[role_idx]["filled_by_user_id"] = applicant_id
    roles[role_idx]["user_id"] = applicant_id

    # 2. Check if all roles are now filled
    all_filled = all(r.get("is_filled", False) for r in roles)
    new_squad_status = "full" if all_filled else "recruiting"

    squad_ref.update({
        "roles": roles,
        "status": new_squad_status,
        "members": ArrayUnion([applicant_id])

    })

    # 3. Update accepted application
    app_ref.update({
        "status": "accepted",
        "updated_at": now
    })

    # 4. Auto-reject other pending applications for this same role slot
    other_pending = (
        db.collection("applications")
        .where("squad_id", "==", squad_id)
        .where("role_index", "==", role_idx)
        .where("status", "==", "pending")
        .stream()
    )
    for pending_doc in other_pending:
        if pending_doc.id != application_id:
            pending_doc.reference.update({
                "status": "rejected",
                "updated_at": now
            })

    application["status"] = "accepted"
    application["updated_at"] = now
    application["id"] = application_id
    return application


# app/routers/applications.py

@router.post("/{application_id}/reject", response_model=ApplicationResponse)
async def reject_application(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Leader route: Reject an incoming pending application.
    - Only callable by the leader of the squad that received the application.
    - Application must currently be in 'pending' status.
    - Decrements the pending applicant count automatically.
    """
    current_uid = current_user["uid"]

    app_ref = db.collection("applications").document(application_id)
    app_doc = app_ref.get()

    if not app_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application '{application_id}' not found"
        )

    app_data = app_doc.to_dict()

    # 1. State check
    if app_data.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject an application with status '{app_data.get('status')}'. Only 'pending' applications can be rejected."
        )

    # 2. Squad leadership validation
    squad_id = app_data.get("squad_id")
    squad_ref = db.collection("squads").document(squad_id)
    squad_doc = squad_ref.get()

    if not squad_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated squad no longer exists"
        )

    squad_data = squad_doc.to_dict()
    if squad_data.get("leader_id") != current_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the squad leader can reject applications"
        )

    # 3. Transition status to 'rejected'
    now = datetime.now(timezone.utc)
    app_ref.update({
        "status": "rejected",
        "updated_at": now
    })

    app_data["id"] = app_doc.id
    app_data["status"] = "rejected"
    app_data["updated_at"] = now

    return app_data

#Apllications withdrawal

@router.post("/{application_id}/withdraw", response_model=ApplicationResponse)
async def withdraw_application(
    application_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Applicant route: Withdraw/cancel a pending application.
    - Only callable by the applicant who submitted it.
    - Only allowed if status is currently 'pending'.
    """
    current_uid = current_user["uid"]
    app_ref = db.collection("applications").document(application_id)
    app_doc = app_ref.get()

    if not app_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application '{application_id}' not found"
        )

    app_data = app_doc.to_dict()

    # 1. Ensure caller is the applicant
    if app_data.get("applicant_id") != current_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only withdraw your own applications"
        )

    # 2. Check that it is still pending
    current_status = app_data.get("status")
    if current_status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot withdraw an application with status '{current_status}'. Only 'pending' applications can be withdrawn."
        )

    # 3. Update status to 'withdrawn'
    now = datetime.now(timezone.utc)
    app_ref.update({
        "status": "withdrawn",
        "updated_at": now
    })

    app_data["id"] = app_doc.id
    app_data["status"] = "withdrawn"
    app_data["updated_at"] = now

    return app_data