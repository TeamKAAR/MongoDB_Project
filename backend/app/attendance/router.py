from datetime import UTC, datetime
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator

from auth.permissions import ensure_course_access, ensure_student_access
from auth.router import get_current_user
from database import get_courses_collection, get_database, get_enrollments_collection, get_students_collection


router = APIRouter(prefix="/api/v1/attendance", tags=["attendance"])


def get_attendance_collection():
    return get_database()["attendance"]


AttendanceStatus = Literal["present", "absent", "late", "excused"]


class AttendanceItem(BaseModel):
    student_id: str
    status: AttendanceStatus = "present"

    @field_validator("student_id")
    @classmethod
    def validate_student_id(cls, value: str) -> str:
        if not ObjectId.is_valid(value):
            raise ValueError("Student id is invalid.")
        return value


class AttendanceBulkRequest(BaseModel):
    course_id: str
    date: datetime
    items: list[AttendanceItem]

    @field_validator("course_id")
    @classmethod
    def validate_course_id(cls, value: str) -> str:
        if not ObjectId.is_valid(value):
            raise ValueError("Course id is invalid.")
        return value


class AttendanceRecord(BaseModel):
    id: str
    student_id: str
    student_name: str
    course_id: str
    course_name: str
    status: AttendanceStatus
    date: datetime


class AttendanceSummaryItem(BaseModel):
    course_id: str
    course_name: str
    total_classes: int
    present: int
    absent: int
    percentage: float


def _object_id_or_404(value: str, message: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
    return ObjectId(value)


def _attendance_pipeline(match_stage: dict) -> list[dict]:
    return [
        {"$match": match_stage},
        {
            "$lookup": {
                "from": "students",
                "localField": "student_id",
                "foreignField": "_id",
                "as": "student",
            }
        },
        {"$unwind": "$student"},
        {
            "$lookup": {
                "from": "courses",
                "localField": "course_id",
                "foreignField": "_id",
                "as": "course",
            }
        },
        {"$unwind": "$course"},
        {
            "$project": {
                "_id": 0,
                "id": {"$toString": "$_id"},
                "student_id": {"$toString": "$student._id"},
                "student_name": {"$concat": ["$student.name.first", " ", "$student.name.last"]},
                "course_id": {"$toString": "$course._id"},
                "course_name": "$course.name",
                "status": 1,
                "date": 1,
            }
        },
        {"$sort": {"date": -1}},
    ]


@router.post("/bulk", response_model=list[AttendanceRecord], status_code=status.HTTP_201_CREATED)
async def bulk_mark_attendance(
    payload: AttendanceBulkRequest,
    current_user: dict = Depends(get_current_user),
) -> list[AttendanceRecord]:
    course_object_id = _object_id_or_404(payload.course_id, "Course not found.")

    if await get_courses_collection().find_one({"_id": course_object_id}) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    await ensure_course_access(current_user, course_object_id)

    active_enrollments = await get_enrollments_collection().find(
        {"course_id": course_object_id, "status": "active"},
        projection={"student_id": 1},
    ).to_list(length=None)
    enrolled_student_ids = {str(row["student_id"]) for row in active_enrollments}

    documents = []
    for item in payload.items:
        if item.student_id not in enrolled_student_ids:
            continue

        documents.append(
            {
                "student_id": ObjectId(item.student_id),
                "course_id": course_object_id,
                "status": item.status,
                "date": payload.date.astimezone(UTC),
            }
        )

    if not documents:
        return []

    attendance = get_attendance_collection()
    for document in documents:
        await attendance.delete_many(
            {
                "student_id": document["student_id"],
                "course_id": course_object_id,
                "date": payload.date.astimezone(UTC),
            }
        )

    result = await attendance.insert_many(documents)
    rows = await attendance.aggregate(_attendance_pipeline({"_id": {"$in": result.inserted_ids}})).to_list(length=None)
    return [AttendanceRecord(**row) for row in rows]


@router.get("/course/{course_id}", response_model=list[AttendanceRecord])
async def list_attendance_for_course(
    course_id: str,
    date: datetime | None = Query(default=None),
    current_user: dict = Depends(get_current_user),
) -> list[AttendanceRecord]:
    course_object_id = _object_id_or_404(course_id, "Course not found.")
    await ensure_course_access(current_user, course_object_id)
    query: dict = {"course_id": course_object_id}
    if date is not None:
        query["date"] = date.astimezone(UTC)
    rows = await get_attendance_collection().aggregate(_attendance_pipeline(query)).to_list(length=None)
    return [AttendanceRecord(**row) for row in rows]


@router.get("/student/{student_id}", response_model=list[AttendanceRecord])
async def list_attendance_for_student(student_id: str, current_user: dict = Depends(get_current_user)) -> list[AttendanceRecord]:
    student_object_id = _object_id_or_404(student_id, "Student not found.")
    await ensure_student_access(current_user, student_object_id)
    match_stage: dict = {"student_id": student_object_id}
    if current_user["role"] == "teacher":
        taught_courses = await get_courses_collection().distinct("_id", {"teacher_id": current_user["_id"]})
        match_stage["course_id"] = {"$in": taught_courses}
    rows = await get_attendance_collection().aggregate(_attendance_pipeline(match_stage)).to_list(length=None)
    return [AttendanceRecord(**row) for row in rows]


@router.get("/student/{student_id}/summary", response_model=list[AttendanceSummaryItem])
async def attendance_summary_for_student(
    student_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[AttendanceSummaryItem]:
    student_object_id = _object_id_or_404(student_id, "Student not found.")
    await ensure_student_access(current_user, student_object_id)
    pipeline = [
        {"$match": {"student_id": student_object_id}},
    ]
    if current_user["role"] == "teacher":
        taught_courses = await get_courses_collection().distinct("_id", {"teacher_id": current_user["_id"]})
        pipeline.append({"$match": {"course_id": {"$in": taught_courses}}})
    pipeline.extend([
        {
            "$group": {
                "_id": "$course_id",
                "total_classes": {"$sum": 1},
                "present": {
                    "$sum": {
                        "$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]
                    }
                },
                "absent": {
                    "$sum": {
                        "$cond": [{"$eq": ["$status", "absent"]}, 1, 0]
                    }
                },
            }
        },
        {
            "$lookup": {
                "from": "courses",
                "localField": "_id",
                "foreignField": "_id",
                "as": "course",
            }
        },
        {"$unwind": {"path": "$course", "preserveNullAndEmptyArrays": True}},
        {
            "$project": {
                "_id": 0,
                "course_id": {"$toString": "$course._id"},
                "course_name": "$course.name",
                "total_classes": 1,
                "present": 1,
                "absent": 1,
                "percentage": {
                    "$round": [
                        {
                            "$multiply": [
                                {"$divide": ["$present", {"$max": ["$total_classes", 1]}]},
                                100,
                            ]
                        },
                        2,
                    ]
                },
            }
        },
    ])
    rows = await get_attendance_collection().aggregate(pipeline).to_list(length=None)
    return [AttendanceSummaryItem(**row) for row in rows]
