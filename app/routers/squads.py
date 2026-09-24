from datetime import datetime, timezone
from typing import List, Optional, Literal
from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.firebase import db
from app.schemas.squads import SquadCreate, SquadResponse, SquadUpdate
from app.dependencies import get_current_user
from app.schemas.squads import SquadCreate, SquadResponse, MySquadsResponse, PaginatedSquadsResponse, SquadRosterResponse, OperativeRosterMember

router = APIRouter(prefix="/squads", tags=["Squads"])


def calculate_squad_status(roles: list) -> str:
    """Returns 'full' if all role slots are filled, otherwise 'recruiting'."""
    if not roles:
        return "recruiting"
    all_filled = all(r.get("is_filled", False) for r in roles)
    return "full" if all_filled else "recruiting"

#Enriching user profiles

def enrich_squad_roles(squad_dict: dict, user_cache: dict = None) -> dict:
    """
    Enriches a squad's roles with public member profiles for filled slots
    AND adds a live applicant count for each role.
    """
    if user_cache is None:
        user_cache = {}

    # 1. Extract squad_id needed for the applications query
    squad_id = squad_dict.get("id")
    
    enriched_roles = []
    
    # 2. Use enumerate to get the role index (idx)
    for idx, role in enumerate(squad_dict.get("roles", [])):
        role_dict = dict(role)
        member_id = role_dict.get("filled_by_user_id")

        # --- PROFILE HYDRATION (Your existing code) ---
        if role_dict.get("is_filled") and member_id:
            if member_id not in user_cache:
                user_doc = db.collection("users").document(member_id).get()
                if user_doc.exists:
                    u_data = user_doc.to_dict()
                    user_cache[member_id] = {
                        "uid": member_id,
                        "display_name": u_data.get("display_name"),
                        "github_url": u_data.get("github_url"),
                        "primary_skills": u_data.get("primary_skills", []),
                        "contact_handle": u_data.get("contact_handle")
                    }
                else:
                    user_cache[member_id] = {
                        "uid": member_id,
                        "display_name": "Developer",
                        "primary_skills": []
                    }

            role_dict["member_profile"] = user_cache[member_id]
        else:
            role_dict["member_profile"] = None

        # --- NEW: LIVE APPLICANT COUNT ---
        if squad_id:
            count_query = (
                db.collection("applications")
                .where("squad_id", "==", squad_id)
                .where("role_index", "==", idx)
                .where("status", "==", "pending")
                .count()
            )
            count_result = count_query.get()
            # Extract the integer value from Firestore's count result
            role_dict["applicant_count"] = count_result[0][0].value
        else:
            role_dict["applicant_count"] = 0

        enriched_roles.append(role_dict)

    squad_dict["roles"] = enriched_roles
    return squad_dict

#Roster details
@router.get(
    "/{squad_id}/roster",
    response_model=SquadRosterResponse,
    summary="Retrieve fully hydrated roster of operatives for a squad",
    tags=["Squads"]
)
async def get_squad_roster(squad_id: str):
    """
    Hydrates members and dynamically extracts vacant roles defined by the squad leader.
    """
    squad_ref = db.collection("squads").document(squad_id)
    squad_doc = squad_ref.get()

    if not squad_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad with ID '{squad_id}' not found"
        )

    squad_data = squad_doc.to_dict()
    leader_id = squad_data.get("leader_id") or squad_data.get("creator_id", "")
    member_uids = squad_data.get("members", [])
    
    # Fallback: Also gather any UIDs stored inside filled roles
    for r in squad_data.get("roles", []):
        if isinstance(r, dict) and r.get("is_filled"):
            uid = r.get("filled_by_user_id") or r.get("user_id")
            if uid and uid not in member_uids:
                member_uids.append(uid)

    # Ensure leader is considered part of members list
    if leader_id and leader_id not in member_uids:
        member_uids.insert(0, leader_id)

    # 1. Batch-fetch user documents
    hydrated_members = []
    if member_uids:
        user_refs = [db.collection("users").document(uid) for uid in member_uids]
        user_docs = db.get_all(user_refs)
        doc_lookup = {doc.id: doc.to_dict() for doc in user_docs if doc.exists}

        for uid in member_uids:
            user_data = doc_lookup.get(uid, {})
            hydrated_members.append(
                OperativeRosterMember(
                    uid=uid,
                    display_name=user_data.get("display_name") or user_data.get("name") or f"Operative_{uid[:5]}",
                    email=user_data.get("email"),
                    avatar_url=user_data.get("avatar_url"),
                    bio=user_data.get("bio"),
                    primary_skills=user_data.get("primary_skills", []),
                    github_url=user_data.get("github_url"),
                    linkedin_url=user_data.get("linkedin_url"),
                    is_leader=(uid == leader_id)
                )
            )

    # 2. Extract EXACT vacant roles created by the leader
    # Support both list of dicts [{'title': '...', 'status': 'vacant'}] and list of strings
    raw_roles = squad_data.get("roles", [])
    vacant_role_names = []

    if raw_roles:
        for r in raw_roles:
            if isinstance(r, dict):
                # Check status flags
                is_vacant = False
                if "status" in r and r["status"].lower() in ["vacant", "open"]:
                    is_vacant = True
                elif "is_filled" in r and not r["is_filled"]:
                    is_vacant = True
                elif "claimed" in r and not r["claimed"]:
                    is_vacant = True
                elif "status" not in r and "is_filled" not in r and "claimed" not in r:
                    is_vacant = True

                if is_vacant:
                    vacant_role_names.append(r.get("title") or r.get("name") or "Open Role")
            elif isinstance(r, str):
                vacant_role_names.append(r)
    else:
        # Fallback to roles_needed or open_roles if 'roles' isn't used
        vacant_role_names = squad_data.get("roles_needed", squad_data.get("open_roles", []))

    # 3. Dynamic Capacity: (Filled Members) + (Vacant Roles)
    current_count = len(hydrated_members)
    open_slots_count = len(vacant_role_names)
    total_capacity = current_count + open_slots_count

    return SquadRosterResponse(
        squad_id=squad_id,
        squad_name=squad_data.get("name") or squad_data.get("title", "Unnamed Squad"),
        leader_id=leader_id,
        pitch=squad_data.get("pitch") or squad_data.get("description", ""),
        hackathon=squad_data.get("hackathon") or squad_data.get("hackathon_name", "Global Hackathon"),
        tech_stack=squad_data.get("tech_stack", squad_data.get("skills", [])),
        max_members=total_capacity,
        current_count=current_count,
        open_slots_count=open_slots_count,
        open_roles=vacant_role_names,
        members=hydrated_members
    )


@router.post("/", response_model=SquadResponse, status_code=status.HTTP_201_CREATED)
async def create_squad(
    squad_data: SquadCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Creates a squad. The authenticated user's Firebase UID becomes the leader_id.
    """
    leader_id = current_user["uid"]
    now = datetime.now(timezone.utc)
    
    payload = squad_data.model_dump()
    payload["leader_id"] = leader_id
    payload["created_at"] = now
    payload["status"] = calculate_squad_status(payload.get("roles", []))

    update_time, doc_ref = db.collection("squads").add(payload)
    
    return {
        "id": doc_ref.id,
        **payload
    }


@router.get("/", response_model=PaginatedSquadsResponse)
async def list_squads(
    status: Optional[str] = Query(
        None, 
        description="Filter squads by status (e.g. 'recruiting' or 'full')"
    ),
    hackathon_name: Optional[str] = Query(
        None, 
        description="Filter by hackathon name (case-insensitive partial match)"
    ),
    skill: Optional[str] = Query(
        None, 
        description="Filter squads that require a specific skill in any role slot"
    ),
    tech_stack: Optional[str] = Query(
        None, 
        description="Filter by a primary technology in tech_stack"
    ),
    # Pagination & Sorting parameters MUST go inside the function signature:
    limit: int = Query(
        10, 
        ge=1, 
        le=50, 
        description="Number of squads to return per page (max 50)"
    ),
    offset: int = Query(
        0, 
        ge=0, 
        description="Number of squads to skip"
    ),
    order: Literal["desc", "asc"] = Query(
        "desc", 
        description="Sort by created_at: 'desc' (newest first) or 'asc' (oldest first)"
    ),
):
    """
    Public route: Search, filter, sort, and paginate squads.
    Supports filtering by squad status, hackathon, required skills, and tech stack.
    Enriches all filled roles with public member profiles.
    """
    squads_ref = db.collection("squads").stream()
    filtered_squads = []

    # Pre-normalize query parameters for fast case-insensitive checks
    target_status = status.strip().lower() if status else None
    target_hackathon = hackathon_name.strip().lower() if hackathon_name else None
    target_skill = skill.strip().lower() if skill else None
    target_tech = tech_stack.strip().lower() if tech_stack else None

    for doc in squads_ref:
        data = doc.to_dict()
        data["id"] = doc.id

        # 1. Status Filter
        if target_status:
            squad_status = str(data.get("status", "")).strip().lower()
            if squad_status != target_status:
                continue

        # 2. Hackathon Filter (partial case-insensitive match)
        if target_hackathon:
            squad_hackathon = str(data.get("hackathon_name") or "").lower()
            if target_hackathon not in squad_hackathon:
                continue

        # 3. Tech Stack Filter
        if target_tech:
            squad_techs = [str(t).lower() for t in data.get("tech_stack", [])]
            if not any(target_tech in t for t in squad_techs):
                continue

        # 4. Required Skill Filter (searches inside nested role slots)
        if target_skill:
            roles = data.get("roles", [])
            all_skills = [
                str(s).lower()
                for role in roles
                for s in role.get("skills_required", [])
            ]
            if not any(target_skill in s for s in all_skills):
                continue

        filtered_squads.append(data)

    # 5. Sort by created_at
    filtered_squads.sort(
        key=lambda x: str(x.get("created_at") or ""),
        reverse=(order == "desc")
    )

    # 6. Apply Pagination Slice
    total_count = len(filtered_squads)
    paginated_slice = filtered_squads[offset : offset + limit]
    has_more = (offset + limit) < total_count

    # 7. Hydrate only the sliced squads (saves read latency)
    user_cache = {}
    enriched_items = [
        enrich_squad_roles(squad, user_cache=user_cache)
        for squad in paginated_slice
    ]

    return {
        "items": enriched_items,
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "has_more": has_more
    }


@router.get("/me", response_model=MySquadsResponse)
async def get_my_squads(
    current_user: dict = Depends(get_current_user)
):
    """
    Authenticated route: Get squads where the current user is 
    either the leader or an active member occupying a claimed role slot.
    """
    user_id = current_user["uid"]
    squads_ref = db.collection("squads").stream()

    leading_squads = []
    joined_squads = []

    for doc in squads_ref:
        data = doc.to_dict()
        data["id"] = doc.id

        is_leader = data.get("leader_id") == user_id

        if is_leader:
            leading_squads.append(data)

        # Check if user holds a claimed slot in this squad
        roles = data.get("roles", [])
        is_member = any(
            role.get("is_filled") is True and role.get("filled_by_user_id") == user_id
            for role in roles
        )

        # Append to joined only if they are not already listed under leading
        if is_member and not is_leader:
            joined_squads.append(data)

    return {
        "leading": leading_squads,
        "joined": joined_squads
    }

@router.get("/{squad_id}", response_model=SquadResponse)
async def get_squad(squad_id: str):
    """
    Public route: Fetch single squad details, enriched with 
    member profile previews for filled roles.
    """
    doc_ref = db.collection("squads").document(squad_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad with ID '{squad_id}' not found"
        )

    data = doc.to_dict()
    data["id"] = doc.id

    # The helper replaces all the manual loop code:
    return enrich_squad_roles(data)

@router.post("/{squad_id}/claim-role/{role_index}", response_model=SquadResponse)
async def claim_role(
    squad_id: str,
    role_index: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Claim an open role slot. Uses the authenticated user's Firebase UID.
    Prevents duplicate role claims and updates squad capacity.
    """
    user_id = current_user["uid"]

    doc_ref = db.collection("squads").document(squad_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad with ID '{squad_id}' not found"
        )

    squad_data = doc.to_dict()
    roles = squad_data.get("roles", [])

    # Bounds check
    if role_index < 0 or role_index >= len(roles):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role index {role_index}. Squad has {len(roles)} role(s)."
        )

    target_role = roles[role_index]

    # Slot already occupied check
    if target_role.get("is_filled", False):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This role slot is already filled."
        )

    # Duplicate check: Prevent user from claiming multiple roles in the same squad
    for idx, r in enumerate(roles):
        if r.get("filled_by_user_id") == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You have already claimed role index {idx} ({r.get('role_title')}) in this squad."
            )

    # Assign role
    target_role["is_filled"] = True
    target_role["filled_by_user_id"] = user_id
    roles[role_index] = target_role

    # Re-calculate status
    new_status = calculate_squad_status(roles)

    update_payload = {
        "roles": roles,
        "status": new_status
    }
    doc_ref.update(update_payload)

    squad_data.update(update_payload)
    squad_data["id"] = doc.id
    return squad_data


@router.post("/{squad_id}/leave-role/{role_index}", response_model=SquadResponse)
async def leave_role(
    squad_id: str,
    role_index: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Vacates a filled role slot. Can only be executed by the slot holder or squad leader.
    """
    user_id = current_user["uid"]

    doc_ref = db.collection("squads").document(squad_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad with ID '{squad_id}' not found"
        )

    squad_data = doc.to_dict()
    roles = squad_data.get("roles", [])

    # Bounds check
    if role_index < 0 or role_index >= len(roles):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role index {role_index}. Squad has {len(roles)} role(s)."
        )

    target_role = roles[role_index]

    # Slot empty check
    if not target_role.get("is_filled", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This role slot is already vacant."
        )

    # Authorization check: Slot holder or Squad Leader
    is_slot_holder = target_role.get("filled_by_user_id") == user_id
    is_leader = squad_data.get("leader_id") == user_id

    if not (is_slot_holder or is_leader):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only vacate a role you occupy, unless you are the squad leader."
        )

    # Reset role
    target_role["is_filled"] = False
    target_role["filled_by_user_id"] = None
    roles[role_index] = target_role

    # Re-calculate status
    new_status = calculate_squad_status(roles)

    update_payload = {
        "roles": roles,
        "status": new_status
    }
    doc_ref.update(update_payload)

    squad_data.update(update_payload)
    squad_data["id"] = doc.id
    return squad_data


@router.patch("/{squad_id}", response_model=SquadResponse)
async def update_squad(
    squad_id: str,
    update_data: SquadUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Updates squad details. Restricted to the squad leader.
    """
    doc_ref = db.collection("squads").document(squad_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad with ID '{squad_id}' not found"
        )

    squad_data = doc.to_dict()

    # Ownership check
    if squad_data.get("leader_id") != current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the squad leader can update squad settings."
        )

    updates = update_data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields provided for update"
        )

    doc_ref.update(updates)
    updated_doc = doc_ref.get()
    data = updated_doc.to_dict()
    data["id"] = updated_doc.id
    return data


@router.delete("/{squad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_squad(
    squad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Deletes a squad. Restricted to the squad leader.
    """
    doc_ref = db.collection("squads").document(squad_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad with ID '{squad_id}' not found"
        )

    # Ownership check
    if doc.to_dict().get("leader_id") != current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the squad leader can delete this squad."
        )

    doc_ref.delete()
    return None

@router.delete("/{squad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_squad(
    squad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Authenticated route: Delete/disband a squad.
    Enforces authorization: Only the squad's creator (leader_id) can delete it.
    Returns:
        - 204 No Content on successful deletion.
        - 404 Not Found if the squad does not exist.
        - 403 Forbidden if the caller is not the squad leader.
    """
    user_id = current_user["uid"]
    squad_ref = db.collection("squads").document(squad_id)
    doc = squad_ref.get()

    if not doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad with ID '{squad_id}' not found"
        )

    squad_data = doc.to_dict()

    # Authorization Check
    if squad_data.get("leader_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the squad leader can delete this squad"
        )

    # Perform deletion
    squad_ref.delete()
    return None

#Vacate Member

@router.post("/{squad_id}/roles/{role_index}/vacate", response_model=SquadResponse)
async def vacate_squad_role(
    squad_id: str,
    role_index: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Vacate a role slot in a squad.
    Can be initiated by:
      1. The teammate currently occupying the role (voluntarily leaving).
      2. The squad leader (removing/kicking a teammate).
    
    Actions taken:
      - Marks role slot as is_filled = False and filled_by_user_id = None.
      - Sets squad status to 'recruiting'.
      - Marks the accepted application for this member as 'resigned'/'removed'.
    """
    current_uid = current_user["uid"]
    squad_ref = db.collection("squads").document(squad_id)
    squad_doc = squad_ref.get()

    if not squad_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad '{squad_id}' not found"
        )

    squad_data = squad_doc.to_dict()
    roles = squad_data.get("roles", [])

    if role_index < 0 or role_index >= len(roles):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role index {role_index} is out of range"
        )

    target_role = roles[role_index]
    if not target_role.get("is_filled", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot vacate an unfilled role slot"
        )

    occupant_id = target_role.get("filled_by_user_id")
    leader_id = squad_data.get("leader_id")

    # Authorization check
    is_occupant = current_uid == occupant_id
    is_leader = current_uid == leader_id

    if not (is_occupant or is_leader):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the role occupant or the squad leader can vacate this slot"
        )

    now = datetime.now(timezone.utc)

    # 1. Clear the role slot
    target_role["is_filled"] = False
    target_role["filled_by_user_id"] = None
    target_role["member_profile"] = None

    # 2. Reset squad status back to recruiting
    squad_data["status"] = "recruiting"
    squad_data["roles"] = roles

    squad_ref.update({
        "roles": roles,
        "status": "recruiting",
        "updated_at": now
    })

    # 3. Update related application record in applications collection
    apps_query = (
        db.collection("applications")
        .where("squad_id", "==", squad_id)
        .where("role_index", "==", role_index)
        .where("applicant_id", "==", occupant_id)
        .where("status", "==", "accepted")
        .stream()
    )
    resolution_status = "resigned" if is_occupant else "removed"
    for app_doc in apps_query:
        app_doc.reference.update({
            "status": resolution_status,
            "updated_at": now
        })

    squad_data["id"] = squad_doc.id

    # 4. Enrich remaining filled roles for the SquadResponse return model
    for idx, role in enumerate(squad_data.get("roles", [])):
        member_id = role.get("filled_by_user_id")
        if role.get("is_filled") and member_id:
            user_doc = db.collection("users").document(member_id).get()
            if user_doc.exists:
                u_data = user_doc.to_dict()
                role["member_profile"] = {
                    "uid": member_id,
                    "display_name": u_data.get("display_name"),
                    "github_url": u_data.get("github_url"),
                    "primary_skills": u_data.get("primary_skills", []),
                    "contact_handle": u_data.get("contact_handle")
                }
            else:
                role["member_profile"] = {
                    "uid": member_id,
                    "display_name": "Developer",
                    "primary_skills": []
                }
        else:
            role["member_profile"] = None

    return squad_data

#Patch and Deletion of squad

@router.patch("/{squad_id}", response_model=SquadResponse)
async def update_squad(
    squad_id: str,
    update_data: SquadUpdate,
    current_user: dict = Depends(get_current_user)
):
    """
    Leader route: Safely update squad metadata and roles.
    - Only the squad creator (leader_id) can modify details.
    - Preserves existing filled role assignments.
    """
    squad_ref = db.collection("squads").document(squad_id)
    squad_doc = squad_ref.get()

    if not squad_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad '{squad_id}' not found"
        )

    squad = squad_doc.to_dict()

    # 1. Authorization check
    if squad.get("leader_id") != current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the squad leader can edit squad details"
        )

    # 2. Extract fields explicitly provided in the request
    payload = update_data.model_dump(exclude_unset=True)

    # 3. Role validation safeguard
    if "roles" in payload:
        new_roles = payload["roles"]
        existing_roles = squad.get("roles", [])

        # Prevent shrinking the role list if filled slots exist beyond the new length
        for idx, existing_role in enumerate(existing_roles):
            if existing_role.get("is_filled"):
                if idx >= len(new_roles):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot remove role slot {idx} ({existing_role.get('role_title')}) because it is already filled by a team member."
                    )
                # Keep the filled member intact even if the leader edits title or skills
                new_roles[idx]["is_filled"] = True
                new_roles[idx]["filled_by_user_id"] = existing_role.get("filled_by_user_id")

        payload["roles"] = new_roles

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid fields provided for update"
        )

    # 4. Commit updates to Firestore
    squad_ref.update(payload)

    # 5. Fetch updated state and enrich for response
    updated_doc = squad_ref.get().to_dict()
    updated_doc["id"] = squad_id
    enriched_squad = enrich_squad_roles(updated_doc)

    return enriched_squad


@router.delete("/{squad_id}", status_code=status.HTTP_200_OK)
async def delete_squad(
    squad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Leader route: Disband and delete a squad.
    - Only the squad leader can delete.
    - Cascades status update to active applications to prevent orphaned states.
    """
    squad_ref = db.collection("squads").document(squad_id)
    squad_doc = squad_ref.get()

    if not squad_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Squad '{squad_id}' not found"
        )

    squad = squad_doc.to_dict()

    # 1. Authorization check
    if squad.get("leader_id") != current_user["uid"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only the squad leader can delete the squad"
        )

    # 2. Cascade cleanup: mark all pending applications as rejected/withdrawn
    apps_query = db.collection("applications").where("squad_id", "==", squad_id).stream()
    batch = db.batch()
    now = datetime.now(timezone.utc)

    for app in apps_query:
        app_ref = db.collection("applications").document(app.id)
        batch.update(app_ref, {
            "status": "withdrawn",
            "updated_at": now,
            "disbanded_reason": "Squad was deleted by leader"
        })

    # 3. Delete the squad document
    batch.delete(squad_ref)
    batch.commit()

    return {"message": f"Squad '{squad_id}' and associated applications successfully cleaned up"}