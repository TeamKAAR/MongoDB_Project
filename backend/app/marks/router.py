from datetime import UTC, datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from auth.permissions import ensure_course_access, ensure_student_access
from auth.router import get_current_user
from database import get_courses_collection, get_database, get_enrollments_collection, get_students_collection


router = APIRouter(prefix="/api/v1/marks", tags=["marks"])


def get_marks_collection():
    return get_database()["marks"]


def calculate_grade_and_gpa(percentage: float) -> tuple[str, float]:
    if percentage >= 90:
        return "A+", 4.0
    if percentage >= 80:
        return "A", 3.7
    if percentage >= 70:
        return "B", 3.0
    if percentage >= 60:
        return "C", 2.0
    if percentage >= 50:
        return "D", 1.0
    return "F", 0.0


class MarkCreate(BaseModel):
    student_id: str
    course_id: str
    assessment_type: str = Field(min_length=2, max_length=40)
    assessment_name: str = Field(min_length=2, max_length=80)
    marks_obtained: float = Field(ge=0)
    max_marks: float = Field(gt=0)
    date: datetime
    remarks: str = ""

    @field_validator("student_id", "course_id")
    @classmethod
    def validate_object_id(cls, value: str) -> str:
        if not ObjectId.is_valid(value):
            raise ValueError("Object id is invalid.")
        return value

    @field_validator("assessment_type", "assessment_name", "remarks")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip()


class MarkUpdate(MarkCreate):
    pass


class MarkResponse(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_code: str
    course_id: str
    course_code: str
    course_name: str
    assessment_type: str
    assessment_name: str
    marks_obtained: float
    max_marks: float
    percentage: float
    grade: str
    gpa: float
    date: datetime
    remarks: str


class MarksStudentSummary(BaseModel):
    overall_gpa: float | None = None
    average_percentage: float | None = None


class MarksStudentResponse(BaseModel):
    items: list[MarkResponse]
    summary: MarksStudentSummary


def _object_id_or_404(value: str, message: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)
    return ObjectId(value)


def _marks_pipeline(match_stage: dict) -> list[dict]:
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
                "assessment_type": 1,
                "assessment_name": {"$ifNull": ["$assessment_name", "$assessment_type"]},
                "marks_obtained": 1,
                "max_marks": 1,
                "percentage": 1,
                "grade": 1,
                "gpa": 1,
                "date": {"$ifNull": ["$recorded_at", "$created_at"]},
                "remarks": {"$ifNull": ["$remarks", ""]},
            }
        },
        {"$sort": {"date": -1}},
    ]


def _to_mark_document(payload: MarkCreate | MarkUpdate) -> dict:
    percentage = round((payload.marks_obtained / payload.max_marks) * 100, 2)
    grade, gpa = calculate_grade_and_gpa(percentage)
    return {
        "student_id": ObjectId(payload.student_id),
        "course_id": ObjectId(payload.course_id),
        "assessment_type": payload.assessment_type,
        "assessment_name": payload.assessment_name,
        "marks_obtained": payload.marks_obtained,
        "max_marks": payload.max_marks,
        "percentage": percentage,
        "grade": grade,
        "gpa": gpa,
        "recorded_at": payload.date.astimezone(UTC),
        "remarks": payload.remarks,
    }


@router.post("", response_model=MarkResponse, status_code=status.HTTP_201_CREATED)
async def create_mark(payload: MarkCreate, current_user: dict = Depends(get_current_user)) -> MarkResponse:
    student_object_id = _object_id_or_404(payload.student_id, "Student not found.")
    course_object_id = _object_id_or_404(payload.course_id, "Course not found.")

    if await get_students_collection().find_one({"_id": student_object_id}) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")
    if await get_courses_collection().find_one({"_id": course_object_id}) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found.")
    await ensure_course_access(current_user, course_object_id)
    await ensure_student_access(current_user, student_object_id)
    enrollment = await get_enrollments_collection().find_one(
        {"student_id": student_object_id, "course_id": course_object_id, "status": "active"},
        projection={"_id": 1},
    )
    if enrollment is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student is not actively enrolled in this course.",
        )

    document = _to_mark_document(payload)
    result = await get_marks_collection().insert_one(document)
    row = await get_marks_collection().aggregate(_marks_pipeline({"_id": result.inserted_id})).to_list(length=1)
    return MarkResponse(**row[0])


@router.put("/{mark_id}", response_model=MarkResponse)
async def update_mark(mark_id: str, payload: MarkUpdate, current_user: dict = Depends(get_current_user)) -> MarkResponse:
    mark_object_id = _object_id_or_404(mark_id, "Mark not found.")
    existing = await get_marks_collection().find_one({"_id": mark_object_id})
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mark not found.")
    await ensure_course_access(current_user, existing["course_id"])
    await ensure_student_access(current_user, existing["student_id"])

    await get_marks_collection().update_one({"_id": mark_object_id}, {"$set": _to_mark_document(payload)})
    row = await get_marks_collection().aggregate(_marks_pipeline({"_id": mark_object_id})).to_list(length=1)
    return MarkResponse(**row[0])


@router.get("/student/{student_id}", response_model=MarksStudentResponse)
async def list_marks_for_student(student_id: str, current_user: dict = Depends(get_current_user)) -> MarksStudentResponse:
    student_object_id = _object_id_or_404(student_id, "Student not found.")
    await ensure_student_access(current_user, student_object_id)
    match_stage: dict = {"student_id": student_object_id}
    if current_user["role"] == "teacher":
        taught_courses = await get_courses_collection().distinct("_id", {"teacher_id": current_user["_id"]})
        match_stage["course_id"] = {"$in": taught_courses}
    rows = await get_marks_collection().aggregate(_marks_pipeline(match_stage)).to_list(length=None)
    if not rows:
        return MarksStudentResponse(items=[], summary=MarksStudentSummary())

    overall_gpa = round(sum(row["gpa"] for row in rows) / len(rows), 2)
    average_percentage = round(sum(row["percentage"] for row in rows) / len(rows), 2)
    return MarksStudentResponse(
        items=[MarkResponse(**row) for row in rows],
        summary=MarksStudentSummary(overall_gpa=overall_gpa, average_percentage=average_percentage),
    )


@router.get("/course/{course_id}", response_model=list[MarkResponse])
async def list_marks_for_course(course_id: str, current_user: dict = Depends(get_current_user)) -> list[MarkResponse]:
    course_object_id = _object_id_or_404(course_id, "Course not found.")
    await ensure_course_access(current_user, course_object_id)
    rows = await get_marks_collection().aggregate(_marks_pipeline({"course_id": course_object_id})).to_list(length=None)
    return [MarkResponse(**row) for row in rows]
