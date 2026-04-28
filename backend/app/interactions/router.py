from datetime import UTC, datetime
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict

from auth.permissions import require_roles
from auth.router import get_current_user
from database import get_database


router = APIRouter(prefix="/api/v1/interactions", tags=["interactions"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class InteractionCreate(BaseModel):
    mentorship_id: str
    meeting_date: datetime
    type: Literal["1-on-1", "academic_review", "behavioral", "check_in"]
    remarks: str = ""
    action_items: list[str] = []
    next_meeting_date: datetime | None = None


class InteractionResponse(BaseModel):
    id: str
    mentorship_id: str
    meeting_date: datetime
    type: str
    remarks: str
    action_items: list[str]
    next_meeting_date: datetime | None = None
    logged_by: str
    logged_by_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InteractionListResponse(BaseModel):
    items: list[InteractionResponse]
    total: int


class UpcomingMeeting(BaseModel):
    interaction_id: str
    mentorship_id: str
    student_id: str
    student_name: str | None = None
    student_code: str | None = None
    next_meeting_date: datetime
    last_type: str


class UpcomingMeetingsResponse(BaseModel):
    items: list[UpcomingMeeting]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_object_id(value: str, label: str = "ID") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label}.",
        )
    return ObjectId(value)


def _serialize_interaction(doc: dict) -> InteractionResponse:
    logger_info = doc.get("logger_info")
    return InteractionResponse(
        id=str(doc["_id"]),
        mentorship_id=str(doc["mentorship_id"]),
        meeting_date=doc["meeting_date"],
        type=doc["type"],
        remarks=doc.get("remarks", ""),
        action_items=doc.get("action_items", []),
        next_meeting_date=doc.get("next_meeting_date"),
        logged_by=str(doc["logged_by"]),
        logged_by_name=logger_info.get("name") if logger_info else None,
        created_at=doc["created_at"],
    )


# ---------------------------------------------------------------------------
# Seed helper – create demo interaction data on startup
# ---------------------------------------------------------------------------

async def ensure_demo_interactions() -> None:
    db = get_database()
    interactions = db["interactions"]

    if await interactions.count_documents({}) > 0:
        return

    mentorships = await db["mentorships"].find({"status": "active"}).to_list(length=3)
    teacher = await db["users"].find_one({"email": "teacher@edutrack.com"}, projection={"_id": 1})

    if not mentorships or teacher is None:
        return

    now = datetime.now(UTC)
    docs = [
        {
            "mentorship_id": mentorships[0]["_id"],
            "meeting_date": datetime(2026, 3, 20, 10, 0, tzinfo=UTC),
            "type": "1-on-1",
            "remarks": "Discussed semester goals and areas for improvement in mathematics.",
            "action_items": ["Revise calculus chapters 4-6", "Submit missed assignments"],
            "next_meeting_date": datetime(2026, 4, 18, 10, 0, tzinfo=UTC),
            "logged_by": teacher["_id"],
            "created_at": now,
        },
        {
            "mentorship_id": mentorships[0]["_id"],
            "meeting_date": datetime(2026, 4, 3, 14, 0, tzinfo=UTC),
            "type": "academic_review",
            "remarks": "Midterm performance review. Student showing steady improvement.",
            "action_items": ["Continue weekly study group", "Prepare presentation for CS101"],
            "next_meeting_date": datetime(2026, 4, 20, 14, 0, tzinfo=UTC),
            "logged_by": teacher["_id"],
            "created_at": now,
        },
    ]

    if len(mentorships) > 1:
        docs.append({
            "mentorship_id": mentorships[1]["_id"],
            "meeting_date": datetime(2026, 3, 25, 11, 0, tzinfo=UTC),
            "type": "check_in",
            "remarks": "Quick check-in on well-being and work-life balance.",
            "action_items": ["Join campus wellness program"],
            "next_meeting_date": datetime(2026, 4, 22, 11, 0, tzinfo=UTC),
            "logged_by": teacher["_id"],
            "created_at": now,
        })

    await interactions.insert_many(docs)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
async def log_interaction(
    payload: InteractionCreate,
    current_user: dict = Depends(require_roles("admin", "teacher")),
) -> InteractionResponse:
    """Log a new meeting / interaction for a mentorship."""
    db = get_database()
    mentorship_oid = _validate_object_id(payload.mentorship_id, "mentorship_id")

    # Verify mentorship exists
    mentorship = await db["mentorships"].find_one({"_id": mentorship_oid})
    if mentorship is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mentorship not found.",
        )

    # Teachers can only log interactions for their own mentees
    if current_user["role"] == "teacher" and mentorship["teacher_id"] != current_user["_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only log interactions for your own mentees.",
        )

    now = datetime.now(UTC)
    document = {
        "mentorship_id": mentorship_oid,
        "meeting_date": payload.meeting_date,
        "type": payload.type,
        "remarks": payload.remarks,
        "action_items": payload.action_items,
        "next_meeting_date": payload.next_meeting_date,
        "logged_by": current_user["_id"],
        "created_at": now,
    }

    result = await db["interactions"].insert_one(document)
    document["_id"] = result.inserted_id

    return InteractionResponse(
        id=str(document["_id"]),
        mentorship_id=str(document["mentorship_id"]),
        meeting_date=document["meeting_date"],
        type=document["type"],
        remarks=document["remarks"],
        action_items=document["action_items"],
        next_meeting_date=document.get("next_meeting_date"),
        logged_by=str(document["logged_by"]),
        logged_by_name=current_user.get("name"),
        created_at=document["created_at"],
    )


@router.get("/mentorship/{mentorship_id}", response_model=InteractionListResponse)
async def get_interactions_by_mentorship(
    mentorship_id: str,
    current_user: dict = Depends(require_roles("admin", "teacher")),
) -> InteractionListResponse:
    """Get timeline of interactions for a specific mentorship."""
    db = get_database()
    mentorship_oid = _validate_object_id(mentorship_id, "mentorship_id")

    # Access control for teachers
    if current_user["role"] == "teacher":
        mentorship = await db["mentorships"].find_one({"_id": mentorship_oid})
        if mentorship is None or mentorship["teacher_id"] != current_user["_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view interactions for your own mentees.",
            )

    pipeline = [
        {"$match": {"mentorship_id": mentorship_oid}},
        {"$sort": {"meeting_date": -1}},
        {
            "$lookup": {
                "from": "users",
                "localField": "logged_by",
                "foreignField": "_id",
                "as": "logger_info_arr",
            }
        },
        {"$unwind": {"path": "$logger_info_arr", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {"logger_info": {"name": "$logger_info_arr.name"}}},
    ]

    docs = await db["interactions"].aggregate(pipeline).to_list(length=None)
    items = [_serialize_interaction(doc) for doc in docs]

    return InteractionListResponse(items=items, total=len(items))


@router.get("/student/{student_id}", response_model=InteractionListResponse)
async def get_interactions_by_student(
    student_id: str,
    current_user: dict = Depends(get_current_user),
) -> InteractionListResponse:
    """Get timeline of all interactions for a student (across mentorships)."""
    db = get_database()
    student_oid = _validate_object_id(student_id, "student_id")

    # Students can only view their own interactions
    if current_user["role"] == "student":
        from auth.permissions import get_linked_student_object_id
        linked_id = get_linked_student_object_id(current_user)
        if linked_id is None or linked_id != student_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only view their own interactions.",
            )

    # Find all mentorship IDs for this student
    mentorship_ids = await db["mentorships"].distinct("_id", {"student_id": student_oid})
    if not mentorship_ids:
        return InteractionListResponse(items=[], total=0)

    # Access control for teachers – only their own mentees
    if current_user["role"] == "teacher":
        own_mentorship_ids = await db["mentorships"].distinct(
            "_id",
            {"student_id": student_oid, "teacher_id": current_user["_id"]},
        )
        mentorship_ids = own_mentorship_ids

    if not mentorship_ids:
        return InteractionListResponse(items=[], total=0)

    pipeline = [
        {"$match": {"mentorship_id": {"$in": mentorship_ids}}},
        {"$sort": {"meeting_date": -1}},
        {
            "$lookup": {
                "from": "users",
                "localField": "logged_by",
                "foreignField": "_id",
                "as": "logger_info_arr",
            }
        },
        {"$unwind": {"path": "$logger_info_arr", "preserveNullAndEmptyArrays": True}},
        {"$addFields": {"logger_info": {"name": "$logger_info_arr.name"}}},
    ]

    docs = await db["interactions"].aggregate(pipeline).to_list(length=None)
    items = [_serialize_interaction(doc) for doc in docs]

    return InteractionListResponse(items=items, total=len(items))


@router.get("/upcoming", response_model=UpcomingMeetingsResponse)
async def get_upcoming_meetings(
    current_user: dict = Depends(require_roles("admin", "teacher")),
) -> UpcomingMeetingsResponse:
    """Get upcoming meetings for the logged-in teacher (based on next_meeting_date)."""
    db = get_database()
    now = datetime.now(UTC)

    match_filter: dict = {"next_meeting_date": {"$gte": now}}

    if current_user["role"] == "teacher":
        # Only return meetings for this teacher's mentorships
        mentorship_ids = await db["mentorships"].distinct(
            "_id", {"teacher_id": current_user["_id"], "status": "active"}
        )
        match_filter["mentorship_id"] = {"$in": mentorship_ids}

    pipeline = [
        {"$match": match_filter},
        {"$sort": {"next_meeting_date": 1}},
        {"$limit": 10},
        {
            "$lookup": {
                "from": "mentorships",
                "localField": "mentorship_id",
                "foreignField": "_id",
                "as": "mentorship",
            }
        },
        {"$unwind": {"path": "$mentorship", "preserveNullAndEmptyArrays": True}},
        {
            "$lookup": {
                "from": "students",
                "localField": "mentorship.student_id",
                "foreignField": "_id",
                "as": "student",
            }
        },
        {"$unwind": {"path": "$student", "preserveNullAndEmptyArrays": True}},
        {
            "$project": {
                "_id": 1,
                "mentorship_id": 1,
                "student_id": "$mentorship.student_id",
                "student_name": {
                    "$concat": ["$student.name.first", " ", "$student.name.last"]
                },
                "student_code": "$student.student_id",
                "next_meeting_date": 1,
                "type": 1,
            }
        },
    ]

    docs = await db["interactions"].aggregate(pipeline).to_list(length=None)
    items = [
        UpcomingMeeting(
            interaction_id=str(doc["_id"]),
            mentorship_id=str(doc["mentorship_id"]),
            student_id=str(doc.get("student_id", "")),
            student_name=doc.get("student_name"),
            student_code=doc.get("student_code"),
            next_meeting_date=doc["next_meeting_date"],
            last_type=doc.get("type", ""),
        )
        for doc in docs
    ]

    return UpcomingMeetingsResponse(items=items)
