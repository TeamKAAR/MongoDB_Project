from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from auth.router import get_current_user
from database import get_courses_collection, get_enrollments_collection, get_students_collection


router = APIRouter(prefix="/api/v1/enrollments", tags=["enrollments"])


class EnrollmentCreate(BaseModel):
    student_id: str
    course_id: str

    @field_validator("student_id", "course_id")
    @classmethod
    def validate_object_id(cls, value: str) -> str:
        if not ObjectId.is_valid(value):
            raise ValueError("Object id is invalid.")
        return value


class EnrollmentResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_code: str
    course_id: str
    course_code: str
    course_name: str
    credits: int | None = None
    enrolled_at: datetime
    status: str


def _object_id_or_404(value: str, message: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
    return ObjectId(value)


async def ensure_demo_enrollments() -> None:
    enrollments = get_enrollments_collection()
    if await enrollments.count_documents({}) > 0:
        return

    students = await get_students_collection().find({}, projection={"_id": 1}).sort("student_id", 1).to_list(length=4)
    courses = await get_courses_collection().find({}, projection={"_id": 1}).sort("course_code", 1).to_list(length=3)
    if len(students) < 2 or len(courses) < 3:
        return

    now = datetime.now(UTC)
    await enrollments.insert_many(
        [
            {
                "student_id": students[0]["_id"],
                "course_id": courses[0]["_id"],
                "enrolled_at": datetime(2024, 7, 10, tzinfo=UTC),
                "status": "active",
                "created_at": now,
            },
            {
                "student_id": students[0]["_id"],
                "course_id": courses[1]["_id"],
                "enrolled_at": datetime(2024, 7, 12, tzinfo=UTC),
                "status": "active",
                "created_at": now,
            },
            {
                "student_id": students[1]["_id"],
                "course_id": courses[2]["_id"],
                "enrolled_at": datetime(2024, 7, 14, tzinfo=UTC),
                "status": "active",
                "created_at": now,
            },
        ]
    )


def _enrollment_pipeline(match_stage: dict) -> list[dict]:
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
                "student_code": "$student.student_id",
                "course_id": {"$toString": "$course._id"},
                "course_code": "$course.course_code",
                "course_name": "$course.name",
                "credits": "$course.credits",
                "enrolled_at": "$enrolled_at",
                "status": "$status",
            }
        },
    ]


@router.post("", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def create_enrollment(
    payload: EnrollmentCreate,
    current_user: dict = Depends(get_current_user),
) -> EnrollmentResponse:
    del current_user
    student_id = payload.student_id
    course_id = payload.course_id
    student_object_id = _object_id_or_404(student_id, "Student not found.")
    course_object_id = _object_id_or_404(course_id, "Course not found.")

    student = await get_students_collection().find_one({"_id": student_object_id})
    course = await get_courses_collection().find_one({"_id": course_object_id})
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    if course is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")

    enrollments = get_enrollments_collection()
    if await enrollments.find_one(
        {"student_id": student_object_id, "course_id": course_object_id, "status": "active"}
    ):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student is already enrolled.")

    active_count = await enrollments.count_documents({"course_id": course_object_id, "status": "active"})
    if active_count >= course["capacity"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course is already full.")

    result = await enrollments.insert_one(
        {
            "student_id": student_object_id,
            "course_id": course_object_id,
            "enrolled_at": datetime.now(UTC),
            "status": "active",
            "created_at": datetime.now(UTC),
        }
    )
    rows = await enrollments.aggregate(_enrollment_pipeline({"_id": result.inserted_id})).to_list(length=1)
    return EnrollmentResponse(**rows[0])


@router.delete("/{student_id}/{course_id}", response_model=EnrollmentResponse)
async def delete_enrollment(
    student_id: str,
    course_id: str,
    current_user: dict = Depends(get_current_user),
) -> EnrollmentResponse:
    del current_user
    student_object_id = _object_id_or_404(student_id, "Student not found.")
    course_object_id = _object_id_or_404(course_id, "Course not found.")
    enrollments = get_enrollments_collection()
    enrollment = await enrollments.find_one(
        {"student_id": student_object_id, "course_id": course_object_id, "status": "active"}
    )
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found.")

    await enrollments.update_one(
        {"_id": enrollment["_id"]},
        {"$set": {"status": "dropped", "dropped_at": datetime.now(UTC)}},
    )
    rows = await enrollments.aggregate(_enrollment_pipeline({"_id": enrollment["_id"]})).to_list(length=1)
    return EnrollmentResponse(**rows[0])


@router.get("/student/{student_id}", response_model=list[EnrollmentResponse])
async def list_student_enrollments(
    student_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[EnrollmentResponse]:
    del current_user
    student_object_id = _object_id_or_404(student_id, "Student not found.")
    rows = await get_enrollments_collection().aggregate(
        _enrollment_pipeline({"student_id": student_object_id, "status": "active"})
    ).to_list(length=None)
    return [EnrollmentResponse(**row) for row in rows]


@router.get("/course/{course_id}", response_model=list[EnrollmentResponse])
async def list_course_enrollments(
    course_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[EnrollmentResponse]:
    del current_user
    course_object_id = _object_id_or_404(course_id, "Course not found.")
    rows = await get_enrollments_collection().aggregate(
        _enrollment_pipeline({"course_id": course_object_id, "status": "active"})
    ).to_list(length=None)
    return [EnrollmentResponse(**row) for row in rows]
