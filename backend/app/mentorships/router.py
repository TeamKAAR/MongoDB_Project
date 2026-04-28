from datetime import UTC, datetime
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict

from auth.permissions import require_roles
from auth.router import get_current_user
from database import get_database


router = APIRouter(prefix="/api/v1/mentorships", tags=["mentorships"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class MentorshipCreate(BaseModel):
    teacher_id: str
    student_id: str


class MentorshipResponse(BaseModel):
    id: str
    teacher_id: str
    teacher_name: str | None = None
    student_id: str
    student_name: str | None = None
    student_code: str | None = None
    student_email: str | None = None
    assigned_date: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class MentorshipListResponse(BaseModel):
    items: list[MentorshipResponse]
    total: int


class TeacherOption(BaseModel):
    id: str
    name: str
    email: str


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


def _serialize_mentorship(doc: dict) -> MentorshipResponse:
    teacher_info = doc.get("teacher_info")
    student_info = doc.get("student_info")

    return MentorshipResponse(
        id=str(doc["_id"]),
        teacher_id=str(doc["teacher_id"]),
        teacher_name=teacher_info.get("name") if teacher_info else None,
        student_id=str(doc["student_id"]),
        student_name=(
            f"{student_info['name']['first']} {student_info['name']['last']}"
            if student_info and student_info.get("name")
            else None
        ),
        student_code=student_info.get("student_id") if student_info else None,
        student_email=student_info.get("email") if student_info else None,
        assigned_date=doc["assigned_date"],
        status=doc["status"],
    )


def _serialize_mentorship_simple(doc: dict) -> MentorshipResponse:
    """Serialize when no lookups were performed."""
    return MentorshipResponse(
        id=str(doc["_id"]),
        teacher_id=str(doc["teacher_id"]),
        student_id=str(doc["student_id"]),
        assigned_date=doc["assigned_date"],
        status=doc["status"],
    )


# ---------------------------------------------------------------------------
# Seed helper – create demo mentorship data on startup
# ---------------------------------------------------------------------------

async def ensure_demo_mentorships() -> None:
    db = get_database()
    mentorships = db["mentorships"]

    if await mentorships.count_documents({}) > 0:
        return

    teacher = await db["users"].find_one(
        {"email": "teacher@edutrack.com"},
        projection={"_id": 1},
    )
    students = await (
        db["students"]
        .find({}, projection={"_id": 1})
        .sort("student_id", 1)
        .to_list(length=4)
    )

    if teacher is None or len(students) < 3:
        return

    now = datetime.now(UTC)
    docs = [
        {
            "teacher_id": teacher["_id"],
            "student_id": students[i]["_id"],
            "assigned_date": now,
            "status": "active",
        }
        for i in range(3)
    ]
    await mentorships.insert_many(docs)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/teachers", response_model=list[TeacherOption])
async def list_teachers(
    current_user: dict = Depends(require_roles("admin", "teacher")),
) -> list[TeacherOption]:
    """List all teacher users (for mentor-assignment UI)."""
    del current_user
    db = get_database()
    teachers = await (
        db["users"]
        .find({"role": "teacher", "is_active": True}, projection={"_id": 1, "name": 1, "email": 1})
        .to_list(length=None)
    )
    return [
        TeacherOption(id=str(t["_id"]), name=t["name"], email=t["email"])
        for t in teachers
    ]


@router.post("", response_model=MentorshipResponse, status_code=status.HTTP_201_CREATED)
async def assign_mentorship(
    payload: MentorshipCreate,
    current_user: dict = Depends(require_roles("admin", "teacher")),
) -> MentorshipResponse:
    """Assign a student to a teacher. Auto-transfers if student already has an active mentor."""
    del current_user
    db = get_database()
    mentorships = db["mentorships"]

    teacher_oid = _validate_object_id(payload.teacher_id, "teacher_id")
    student_oid = _validate_object_id(payload.student_id, "student_id")

    # Verify teacher exists and has role=teacher
    teacher = await db["users"].find_one({"_id": teacher_oid, "role": "teacher"})
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found.")

    # Verify student exists
    student = await db["students"].find_one({"_id": student_oid})
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    # If student already has an active mentor, transfer (end the old one)
    existing = await mentorships.find_one({"student_id": student_oid, "status": "active"})
    if existing is not None:
        await mentorships.update_one(
            {"_id": existing["_id"]},
            {"$set": {"status": "transferred"}},
        )

    now = datetime.now(UTC)
    document = {
        "teacher_id": teacher_oid,
        "student_id": student_oid,
        "assigned_date": now,
        "status": "active",
    }
    result = await mentorships.insert_one(document)
    document["_id"] = result.inserted_id

    return _serialize_mentorship_simple(document)


@router.get("/teacher/{teacher_id}", response_model=MentorshipListResponse)
async def get_teacher_mentees(
    teacher_id: str,
    status_filter: str = Query(default="active", alias="status"),
    current_user: dict = Depends(get_current_user),
) -> MentorshipListResponse:
    """Get all mentees for a given teacher.  Teachers can only see their own, admins can see any."""
    teacher_oid = _validate_object_id(teacher_id, "teacher_id")

    # Access control: teachers can only view their own mentees
    if current_user["role"] == "teacher" and current_user["_id"] != teacher_oid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own mentees.",
        )

    if current_user["role"] not in ("admin", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    db = get_database()
    query: dict = {"teacher_id": teacher_oid}
    if status_filter and status_filter != "all":
        query["status"] = status_filter

    pipeline = [
        {"$match": query},
        {"$sort": {"assigned_date": -1}},
        {
            "$lookup": {
                "from": "students",
                "localField": "student_id",
                "foreignField": "_id",
                "as": "student_info",
            }
        },
        {"$unwind": {"path": "$student_info", "preserveNullAndEmptyArrays": True}},
        {
            "$lookup": {
                "from": "users",
                "localField": "teacher_id",
                "foreignField": "_id",
                "as": "teacher_info_arr",
            }
        },
        {"$unwind": {"path": "$teacher_info_arr", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "teacher_info": {"name": "$teacher_info_arr.name"},
            }
        },
    ]

    docs = await db["mentorships"].aggregate(pipeline).to_list(length=None)
    items = [_serialize_mentorship(doc) for doc in docs]

    return MentorshipListResponse(items=items, total=len(items))


@router.get("/student/{student_id}", response_model=MentorshipResponse | None)
async def get_student_mentor(
    student_id: str,
    current_user: dict = Depends(get_current_user),
) -> MentorshipResponse | None:
    """Get active mentorship for a student."""
    student_oid = _validate_object_id(student_id, "student_id")

    # Students can view their own mentorship
    if current_user["role"] == "student":
        from auth.permissions import get_linked_student_object_id
        linked_id = get_linked_student_object_id(current_user)
        if linked_id is None or linked_id != student_oid:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Students can only view their own mentorship.",
            )
    elif current_user["role"] not in ("admin", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action.",
        )

    db = get_database()
    pipeline = [
        {"$match": {"student_id": student_oid, "status": "active"}},
        {
            "$lookup": {
                "from": "users",
                "localField": "teacher_id",
                "foreignField": "_id",
                "as": "teacher_info_arr",
            }
        },
        {"$unwind": {"path": "$teacher_info_arr", "preserveNullAndEmptyArrays": True}},
        {
            "$lookup": {
                "from": "students",
                "localField": "student_id",
                "foreignField": "_id",
                "as": "student_info",
            }
        },
        {"$unwind": {"path": "$student_info", "preserveNullAndEmptyArrays": True}},
        {
            "$addFields": {
                "teacher_info": {"name": "$teacher_info_arr.name"},
            }
        },
    ]

    docs = await db["mentorships"].aggregate(pipeline).to_list(length=1)
    if not docs:
        return None

    return _serialize_mentorship(docs[0])


@router.patch("/{mentorship_id}/status")
async def update_mentorship_status(
    mentorship_id: str,
    new_status: Literal["active", "transferred", "graduated"] = Query(alias="status"),
    current_user: dict = Depends(require_roles("admin", "teacher")),
) -> MentorshipResponse:
    """Update the status of a mentorship (Admin or Teacher)."""
    del current_user
    oid = _validate_object_id(mentorship_id, "mentorship_id")
    db = get_database()

    doc = await db["mentorships"].find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mentorship not found.")

    await db["mentorships"].update_one({"_id": oid}, {"$set": {"status": new_status}})
    doc["status"] = new_status

    return _serialize_mentorship_simple(doc)
