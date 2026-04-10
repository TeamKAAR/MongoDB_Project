from datetime import UTC, datetime
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from auth.router import DEMO_USERS, get_current_user
from database import get_courses_collection, get_enrollments_collection, get_users_collection


router = APIRouter(prefix="/api/v1/courses", tags=["courses"])


class CourseSchedule(BaseModel):
    days: list[str] = Field(min_length=1)
    time: str = Field(min_length=1, max_length=40)
    room: str = Field(min_length=1, max_length=30)

    @field_validator("days")
    @classmethod
    def validate_days(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("Select at least one day.")
        return [day.strip() for day in value]


class CourseBase(BaseModel):
    course_code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=2, max_length=100)
    description: str = Field(min_length=5, max_length=500)
    credits: int = Field(ge=1, le=10)
    teacher_id: str
    schedule: CourseSchedule
    capacity: int = Field(ge=1, le=500)
    status: Literal["active", "archived"] = "active"

    @field_validator("course_code", "name", "description")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("teacher_id")
    @classmethod
    def validate_teacher_id(cls, value: str) -> str:
        if not ObjectId.is_valid(value):
            raise ValueError("Teacher id is invalid.")
        return value


class CourseCreate(CourseBase):
    pass


class CourseUpdate(CourseBase):
    pass


class CourseResponse(BaseModel):
    id: str
    course_code: str
    name: str
    description: str
    credits: int
    teacher_id: str
    teacher_name: str | None = None
    schedule: CourseSchedule
    capacity: int
    status: Literal["active", "archived"]
    enrolled_count: int
    created_at: datetime
    updated_at: datetime


DEMO_COURSES = [
    {
        "course_code": "CS101",
        "name": "Computer Science Foundations",
        "description": "Build core logic, problem solving, and programming fluency.",
        "credits": 4,
        "schedule": {"days": ["Monday", "Wednesday"], "time": "10:00 AM", "room": "A-201"},
        "capacity": 40,
        "status": "active",
    },
    {
        "course_code": "MTH201",
        "name": "Applied Mathematics",
        "description": "Strengthen algebra, calculus, and modeling for engineers.",
        "credits": 3,
        "schedule": {"days": ["Tuesday", "Thursday"], "time": "11:30 AM", "room": "B-104"},
        "capacity": 35,
        "status": "active",
    },
    {
        "course_code": "ENG105",
        "name": "Academic Writing",
        "description": "Practice research writing, citations, and presentation structure.",
        "credits": 2,
        "schedule": {"days": ["Friday"], "time": "09:00 AM", "room": "C-009"},
        "capacity": 30,
        "status": "active",
    },
]


def _course_object_id_or_404(course_id: str) -> ObjectId:
    if not ObjectId.is_valid(course_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    return ObjectId(course_id)


async def _teacher_name_map() -> dict[str, str]:
    teachers = await get_users_collection().find(
        {},
        projection={"name": 1},
    ).to_list(length=None)
    return {str(teacher["_id"]): teacher["name"] for teacher in teachers}


async def _enrollment_counts() -> dict[str, int]:
    pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$course_id", "count": {"$sum": 1}}},
    ]
    rows = await get_enrollments_collection().aggregate(pipeline).to_list(length=None)
    return {str(row["_id"]): row["count"] for row in rows}


async def _serialize_course(course: dict) -> CourseResponse:
    teachers = await _teacher_name_map()
    counts = await _enrollment_counts()
    return CourseResponse(
        id=str(course["_id"]),
        course_code=course["course_code"],
        name=course["name"],
        description=course.get("description", ""),
        credits=course.get("credits", 0),
        teacher_id=str(course.get("teacher_id", "")),
        teacher_name=teachers.get(str(course.get("teacher_id", ""))),
        schedule=course.get("schedule", {"days": ["TBD"], "time": "TBD", "room": "TBD"}),
        capacity=course.get("capacity", 0),
        status=course.get("status", "active"),
        enrolled_count=counts.get(str(course["_id"]), 0),
        created_at=course.get("created_at", datetime.now(UTC)),
        updated_at=course.get("updated_at", datetime.now(UTC)),
    )


async def ensure_demo_courses() -> None:
    courses = get_courses_collection()
    teacher = await get_users_collection().find_one({"email": DEMO_USERS[1]["email"]})
    if teacher is None:
        return

    now = datetime.now(UTC)
    for course in DEMO_COURSES:
        await courses.update_one(
            {"course_code": course["course_code"]},
            {
                "$set": {
                    **course,
                    "teacher_id": teacher["_id"],
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "created_at": now,
                }
            },
            upsert=True,
        )


@router.get("", response_model=list[CourseResponse])
async def list_courses(current_user: dict = Depends(get_current_user)) -> list[CourseResponse]:
    del current_user
    courses = await get_courses_collection().find({}).sort("course_code", 1).to_list(length=None)
    return [await _serialize_course(course) for course in courses]


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    current_user: dict = Depends(get_current_user),
) -> CourseResponse:
    del current_user
    courses = get_courses_collection()
    if await courses.find_one({"course_code": payload.course_code}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists.")

    now = datetime.now(UTC)
    document = payload.model_dump()
    document["teacher_id"] = ObjectId(document["teacher_id"])
    document["created_at"] = now
    document["updated_at"] = now

    result = await courses.insert_one(document)
    created = await courses.find_one({"_id": result.inserted_id})
    return await _serialize_course(created)


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: str, current_user: dict = Depends(get_current_user)) -> CourseResponse:
    del current_user
    object_id = _course_object_id_or_404(course_id)
    course = await get_courses_collection().find_one({"_id": object_id})
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    return await _serialize_course(course)


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str,
    payload: CourseUpdate,
    current_user: dict = Depends(get_current_user),
) -> CourseResponse:
    del current_user
    object_id = _course_object_id_or_404(course_id)
    courses = get_courses_collection()
    existing = await courses.find_one({"_id": object_id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    duplicate = await courses.find_one({"course_code": payload.course_code, "_id": {"$ne": object_id}})
    if duplicate is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists.")

    document = payload.model_dump()
    document["teacher_id"] = ObjectId(document["teacher_id"])
    document["updated_at"] = datetime.now(UTC)

    await courses.update_one({"_id": object_id}, {"$set": document})
    updated = await courses.find_one({"_id": object_id})
    return await _serialize_course(updated)


@router.delete("/{course_id}", response_model=CourseResponse)
async def archive_course(
    course_id: str,
    current_user: dict = Depends(get_current_user),
) -> CourseResponse:
    del current_user
    object_id = _course_object_id_or_404(course_id)
    courses = get_courses_collection()
    course = await courses.find_one({"_id": object_id})
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    await courses.update_one(
        {"_id": object_id},
        {"$set": {"status": "archived", "updated_at": datetime.now(UTC)}},
    )
    archived = await courses.find_one({"_id": object_id})
    return await _serialize_course(archived)
