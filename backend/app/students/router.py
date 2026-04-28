from datetime import UTC, date, datetime
from math import ceil
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from auth.permissions import build_student_scope_query, ensure_student_access, require_roles
from auth.router import get_current_user
from database import get_database, get_students_collection


router = APIRouter(prefix="/api/v1/students", tags=["students"])


class StudentName(BaseModel):
    first: str = Field(min_length=1, max_length=50)
    last: str = Field(min_length=1, max_length=50)

    @field_validator("first", "last")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class StudentAddress(BaseModel):
    street: str = Field(min_length=1, max_length=120)
    city: str = Field(min_length=1, max_length=50)
    state: str = Field(min_length=1, max_length=50)
    pincode: str = Field(min_length=4, max_length=12)

    @field_validator("street", "city", "state", "pincode")
    @classmethod
    def normalize_address(cls, value: str) -> str:
        return value.strip()


class StudentBase(BaseModel):
    name: StudentName
    email: EmailStr
    phone: str = Field(min_length=10, max_length=10)
    date_of_birth: datetime
    gender: Literal["Male", "Female", "Other"]
    address: StudentAddress
    enrollment_date: datetime
    status: Literal["active", "inactive", "graduated"] = "active"
    profile_image: str = ""

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        digits_only = value.strip()
        if not digits_only.isdigit():
            raise ValueError("Phone number must contain only digits.")
        if len(digits_only) != 10:
            raise ValueError("Phone number must be exactly 10 digits.")
        return digits_only

    @field_validator("date_of_birth")
    @classmethod
    def validate_age(cls, value: datetime) -> datetime:
        today = date.today()
        dob = value.date()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if age < 15:
            raise ValueError("Student must be at least 15 years old.")
        return value

    @field_validator("profile_image")
    @classmethod
    def normalize_profile_image(cls, value: str) -> str:
        return value.strip()


class StudentCreate(StudentBase):
    pass


class StudentUpdate(StudentBase):
    pass


class StudentResponse(StudentBase):
    id: str
    student_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StudentListResponse(BaseModel):
    items: list[StudentResponse]
    total: int
    page: int
    limit: int
    pages: int


DEMO_STUDENTS: list[dict] = [
    {
        "student_id": "STU-2026-0001",
        "name": {"first": "Aarav", "last": "Sharma"},
        "email": "student@edutrack.com",
        "phone": "9876543210",
        "date_of_birth": datetime(2005, 2, 14, tzinfo=UTC),
        "gender": "Male",
        "address": {"street": "12 River Lane", "city": "Pune", "state": "Maharashtra", "pincode": "411001"},
        "enrollment_date": datetime(2024, 6, 10, tzinfo=UTC),
        "status": "active",
    },
    {
        "student_id": "STU-2026-0002",
        "name": {"first": "Diya", "last": "Patel"},
        "email": "diya.patel@edutrack.com",
        "phone": "9876543211",
        "date_of_birth": datetime(2004, 11, 3, tzinfo=UTC),
        "gender": "Female",
        "address": {"street": "44 Garden View", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380001"},
        "enrollment_date": datetime(2024, 6, 12, tzinfo=UTC),
        "status": "active",
    },
    {
        "student_id": "STU-2026-0003",
        "name": {"first": "Kabir", "last": "Nair"},
        "email": "kabir.nair@edutrack.com",
        "phone": "9876543212",
        "date_of_birth": datetime(2003, 8, 21, tzinfo=UTC),
        "gender": "Male",
        "address": {"street": "8 Palm Street", "city": "Kochi", "state": "Kerala", "pincode": "682001"},
        "enrollment_date": datetime(2024, 6, 14, tzinfo=UTC),
        "status": "active",
    },
    {
        "student_id": "STU-2026-0004",
        "name": {"first": "Mira", "last": "Singh"},
        "email": "mira.singh@edutrack.com",
        "phone": "9876543213",
        "date_of_birth": datetime(2005, 5, 19, tzinfo=UTC),
        "gender": "Female",
        "address": {"street": "95 Lake Road", "city": "Jaipur", "state": "Rajasthan", "pincode": "302001"},
        "enrollment_date": datetime(2024, 6, 16, tzinfo=UTC),
        "status": "active",
    },
    {
        "student_id": "STU-2026-0005",
        "name": {"first": "Reyansh", "last": "Verma"},
        "email": "reyansh.verma@edutrack.com",
        "phone": "9876543214",
        "date_of_birth": datetime(2002, 9, 8, tzinfo=UTC),
        "gender": "Male",
        "address": {"street": "17 Oak Avenue", "city": "Lucknow", "state": "Uttar Pradesh", "pincode": "226001"},
        "enrollment_date": datetime(2024, 6, 18, tzinfo=UTC),
        "status": "graduated",
    },
    {
        "student_id": "STU-2026-0006",
        "name": {"first": "Anaya", "last": "Reddy"},
        "email": "anaya.reddy@edutrack.com",
        "phone": "9876543215",
        "date_of_birth": datetime(2004, 1, 17, tzinfo=UTC),
        "gender": "Female",
        "address": {"street": "23 Tech Park", "city": "Hyderabad", "state": "Telangana", "pincode": "500001"},
        "enrollment_date": datetime(2024, 6, 20, tzinfo=UTC),
        "status": "active",
    },
    {
        "student_id": "STU-2026-0007",
        "name": {"first": "Vihaan", "last": "Das"},
        "email": "vihaan.das@edutrack.com",
        "phone": "9876543216",
        "date_of_birth": datetime(2003, 4, 7, tzinfo=UTC),
        "gender": "Male",
        "address": {"street": "6 College Row", "city": "Kolkata", "state": "West Bengal", "pincode": "700001"},
        "enrollment_date": datetime(2024, 6, 22, tzinfo=UTC),
        "status": "inactive",
    },
    {
        "student_id": "STU-2026-0008",
        "name": {"first": "Ira", "last": "Mehta"},
        "email": "ira.mehta@edutrack.com",
        "phone": "9876543217",
        "date_of_birth": datetime(2005, 6, 2, tzinfo=UTC),
        "gender": "Female",
        "address": {"street": "51 Market Street", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"},
        "enrollment_date": datetime(2024, 6, 24, tzinfo=UTC),
        "status": "active",
    },
    {
        "student_id": "STU-2026-0009",
        "name": {"first": "Arjun", "last": "Khanna"},
        "email": "arjun.khanna@edutrack.com",
        "phone": "9876543218",
        "date_of_birth": datetime(2004, 10, 1, tzinfo=UTC),
        "gender": "Male",
        "address": {"street": "78 Station Road", "city": "Delhi", "state": "Delhi", "pincode": "110001"},
        "enrollment_date": datetime(2024, 6, 26, tzinfo=UTC),
        "status": "active",
    },
    {
        "student_id": "STU-2026-0010",
        "name": {"first": "Sara", "last": "Joseph"},
        "email": "sara.joseph@edutrack.com",
        "phone": "9876543219",
        "date_of_birth": datetime(2002, 12, 11, tzinfo=UTC),
        "gender": "Female",
        "address": {"street": "39 Beach Road", "city": "Chennai", "state": "Tamil Nadu", "pincode": "600001"},
        "enrollment_date": datetime(2024, 6, 28, tzinfo=UTC),
        "status": "graduated",
    },
    {
        "student_id": "STU-2026-0011",
        "name": {"first": "Nivaan", "last": "Gill"},
        "email": "nivaan.gill@edutrack.com",
        "phone": "9876543220",
        "date_of_birth": datetime(2005, 3, 28, tzinfo=UTC),
        "gender": "Male",
        "address": {"street": "88 Green Avenue", "city": "Chandigarh", "state": "Punjab", "pincode": "160001"},
        "enrollment_date": datetime(2024, 7, 1, tzinfo=UTC),
        "status": "active",
    },
    {
        "student_id": "STU-2026-0012",
        "name": {"first": "Kiara", "last": "Banerjee"},
        "email": "kiara.banerjee@edutrack.com",
        "phone": "9876543221",
        "date_of_birth": datetime(2003, 7, 13, tzinfo=UTC),
        "gender": "Female",
        "address": {"street": "14 Central Plaza", "city": "Bengaluru", "state": "Karnataka", "pincode": "560001"},
        "enrollment_date": datetime(2024, 7, 3, tzinfo=UTC),
        "status": "active",
    },
]

DEMO_COURSES = [
    {
        "course_code": "CS101",
        "name": "Computer Science Foundations",
        "credits": 4,
    },
    {
        "course_code": "MTH201",
        "name": "Applied Mathematics",
        "credits": 3,
    },
    {
        "course_code": "ENG105",
        "name": "Academic Writing",
        "credits": 2,
    },
]


def _student_projection() -> dict[str, int]:
    return {
        "student_id": 1,
        "name": 1,
        "email": 1,
        "phone": 1,
        "date_of_birth": 1,
        "gender": 1,
        "address": 1,
        "enrollment_date": 1,
        "status": 1,
        "profile_image": 1,
        "created_at": 1,
        "updated_at": 1,
    }


def _serialize_student(student: dict) -> StudentResponse:
    return StudentResponse(
        id=str(student["_id"]),
        student_id=student["student_id"],
        name=student["name"],
        email=student["email"],
        phone=student["phone"],
        date_of_birth=student["date_of_birth"],
        gender=student["gender"],
        address=student["address"],
        enrollment_date=student["enrollment_date"],
        status=student["status"],
        profile_image=student.get("profile_image", ""),
        created_at=student["created_at"],
        updated_at=student["updated_at"],
    )


def _get_student_or_404(student_id: str):
    if not ObjectId.is_valid(student_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    return ObjectId(student_id)


async def ensure_demo_students() -> None:
    students = get_students_collection()
    existing_count = await students.count_documents({})

    if existing_count >= len(DEMO_STUDENTS):
        return

    now = datetime.now(UTC)
    operations = []
    for student in DEMO_STUDENTS:
        document = {
            **student,
            "profile_image": "",
            "created_at": now,
            "updated_at": now,
        }
        operations.append(
            students.update_one(
                {"email": student["email"]},
                {"$setOnInsert": document},
                upsert=True,
            )
        )

    for operation in operations:
        await operation


async def ensure_demo_academic_records() -> None:
    database = get_database()
    marks = database["marks"]
    attendance = database["attendance"]
    courses = database["courses"]
    enrollments = database["enrollments"]

    if await marks.count_documents({}) > 0 or await attendance.count_documents({}) > 0:
        return

    students = await (
        get_students_collection()
        .find({}, projection={"_id": 1})
        .sort("student_id", 1)
        .to_list(length=4)
    )
    course_documents = await courses.find({}, projection={"_id": 1, "course_code": 1, "name": 1, "credits": 1}).to_list(length=3)

    if len(students) < 2 or len(course_documents) < 3:
        return

    mark_docs = [
        {
            "student_id": students[0]["_id"],
            "course_id": course_documents[0]["_id"],
            "assessment_type": "Midterm",
            "marks_obtained": 86,
            "max_marks": 100,
            "percentage": 86,
            "grade": "A",
            "gpa": 3.7,
            "recorded_at": datetime(2024, 9, 2, tzinfo=UTC),
        },
        {
            "student_id": students[0]["_id"],
            "course_id": course_documents[1]["_id"],
            "assessment_type": "Quiz",
            "marks_obtained": 44,
            "max_marks": 50,
            "percentage": 88,
            "grade": "A",
            "gpa": 3.8,
            "recorded_at": datetime(2024, 9, 5, tzinfo=UTC),
        },
    ]
    await marks.insert_many(mark_docs)

    attendance_docs = [
        {
            "student_id": students[0]["_id"],
            "course_id": course_documents[0]["_id"],
            "status": "present",
            "date": datetime(2024, 8, 1, tzinfo=UTC),
        },
        {
            "student_id": students[0]["_id"],
            "course_id": course_documents[0]["_id"],
            "status": "present",
            "date": datetime(2024, 8, 3, tzinfo=UTC),
        },
        {
            "student_id": students[0]["_id"],
            "course_id": course_documents[0]["_id"],
            "status": "absent",
            "date": datetime(2024, 8, 5, tzinfo=UTC),
        },
        {
            "student_id": students[0]["_id"],
            "course_id": course_documents[1]["_id"],
            "status": "late",
            "date": datetime(2024, 8, 2, tzinfo=UTC),
        },
        {
            "student_id": students[0]["_id"],
            "course_id": course_documents[1]["_id"],
            "status": "present",
            "date": datetime(2024, 8, 4, tzinfo=UTC),
        },
    ]
    await attendance.insert_many(attendance_docs)


async def _generate_student_id() -> str:
    current_year = datetime.now(UTC).year
    pattern = f"STU-{current_year}-"
    latest = await get_students_collection().find_one(
        {"student_id": {"$regex": f"^{pattern}"}},
        sort=[("student_id", -1)],
        projection={"student_id": 1},
    )

    if latest is None:
        return f"{pattern}0001"

    latest_number = int(str(latest["student_id"]).split("-")[-1])
    return f"{pattern}{latest_number + 1:04d}"


def _search_query(search: str) -> dict:
    trimmed = search.strip()
    if not trimmed:
        return {}

    regex = {"$regex": trimmed, "$options": "i"}
    return {
        "$or": [
            {"student_id": regex},
            {"email": regex},
            {"name.first": regex},
            {"name.last": regex},
        ]
    }


@router.get("", response_model=StudentListResponse)
async def list_students(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: str = Query(default=""),
    status_filter: str = Query(default="", alias="status"),
    current_user: dict = Depends(require_roles("admin", "teacher")),
) -> StudentListResponse:
    query: dict = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter

    search_query = _search_query(search)
    if search_query:
        query.update(search_query)
    query = await build_student_scope_query(current_user, query)

    students = get_students_collection()
    total = await students.count_documents(query)
    cursor = (
        students.find(query, projection=_student_projection())
        .sort("enrollment_date", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )
    items = [_serialize_student(student) async for student in cursor]

    return StudentListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=max(1, ceil(total / limit)) if total else 1,
    )


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(
    payload: StudentCreate,
    current_user: dict = Depends(require_roles("admin")),
) -> StudentResponse:
    del current_user

    students = get_students_collection()
    existing_student = await students.find_one({"email": payload.email})
    if existing_student is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists.")

    now = datetime.now(UTC)
    document = payload.model_dump()
    document.update(
        {
            "student_id": await _generate_student_id(),
            "created_at": now,
            "updated_at": now,
        }
    )

    result = await students.insert_one(document)
    created = await students.find_one({"_id": result.inserted_id}, projection=_student_projection())
    return _serialize_student(created)


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(
    student_id: str,
    current_user: dict = Depends(get_current_user),
) -> StudentResponse:
    object_id = _get_student_or_404(student_id)
    await ensure_student_access(current_user, object_id)
    student = await get_students_collection().find_one({"_id": object_id}, projection=_student_projection())
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    return _serialize_student(student)


@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(
    student_id: str,
    payload: StudentUpdate,
    current_user: dict = Depends(require_roles("admin")),
) -> StudentResponse:
    del current_user

    object_id = _get_student_or_404(student_id)
    students = get_students_collection()
    existing_student = await students.find_one({"_id": object_id})
    if existing_student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    duplicate_email = await students.find_one({"email": payload.email, "_id": {"$ne": object_id}})
    if duplicate_email is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists.")

    await students.update_one(
        {"_id": object_id},
        {
            "$set": {
                **payload.model_dump(),
                "updated_at": datetime.now(UTC),
            }
        },
    )

    updated_student = await students.find_one({"_id": object_id}, projection=_student_projection())
    return _serialize_student(updated_student)


@router.delete("/{student_id}", response_model=StudentResponse)
async def delete_student(
    student_id: str,
    current_user: dict = Depends(require_roles("admin")),
) -> StudentResponse:
    del current_user

    object_id = _get_student_or_404(student_id)
    students = get_students_collection()
    student = await students.find_one({"_id": object_id})
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found.")

    await students.update_one(
        {"_id": object_id},
        {
            "$set": {
                "status": "inactive",
                "updated_at": datetime.now(UTC),
            }
        },
    )

    updated_student = await students.find_one({"_id": object_id}, projection=_student_projection())
    return _serialize_student(updated_student)


@router.get("/{student_id}/profile/courses")
async def get_student_courses(
    student_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    object_id = _get_student_or_404(student_id)
    await ensure_student_access(current_user, object_id)
    match_stage: dict = {"student_id": object_id, "status": "active"}
    if current_user["role"] == "teacher":
        taught_courses = await get_database()["courses"].distinct("_id", {"teacher_id": current_user["_id"]})
        match_stage["course_id"] = {"$in": taught_courses}

    pipeline = [
        {"$match": match_stage},
        {
            "$lookup": {
                "from": "courses",
                "localField": "course_id",
                "foreignField": "_id",
                "as": "course",
            }
        },
        {"$unwind": {"path": "$course", "preserveNullAndEmptyArrays": True}},
        {
            "$project": {
                "_id": 0,
                "course_id": {"$toString": "$course._id"},
                "course_code": "$course.course_code",
                "course_name": "$course.name",
                "credits": "$course.credits",
                "enrolled_at": "$enrolled_at",
            }
        },
    ]
    items = await get_database()["enrollments"].aggregate(pipeline).to_list(length=None)
    return {"items": items}


@router.get("/{student_id}/profile/marks")
async def get_student_marks(
    student_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    object_id = _get_student_or_404(student_id)
    await ensure_student_access(current_user, object_id)
    match_stage: dict = {"student_id": object_id}
    if current_user["role"] == "teacher":
        taught_courses = await get_database()["courses"].distinct("_id", {"teacher_id": current_user["_id"]})
        match_stage["course_id"] = {"$in": taught_courses}

    pipeline = [
        {"$match": match_stage},
        {
            "$lookup": {
                "from": "courses",
                "localField": "course_id",
                "foreignField": "_id",
                "as": "course",
            }
        },
        {"$unwind": {"path": "$course", "preserveNullAndEmptyArrays": True}},
        {
            "$project": {
                "_id": 0,
                "course_code": "$course.course_code",
                "course_name": "$course.name",
                "assessment_type": 1,
                "marks_obtained": 1,
                "max_marks": 1,
                "percentage": 1,
                "grade": 1,
                "gpa": 1,
                "recorded_at": 1,
            }
        },
    ]
    items = await get_database()["marks"].aggregate(pipeline).to_list(length=None)

    if not items:
        return {"items": [], "summary": {"overall_gpa": None, "average_percentage": None}}

    overall_gpa = round(sum(item["gpa"] for item in items) / len(items), 2)
    average_percentage = round(sum(item["percentage"] for item in items) / len(items), 2)
    return {"items": items, "summary": {"overall_gpa": overall_gpa, "average_percentage": average_percentage}}


@router.get("/{student_id}/profile/attendance")
async def get_student_attendance(
    student_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    object_id = _get_student_or_404(student_id)
    await ensure_student_access(current_user, object_id)
    match_stage: dict = {"student_id": object_id}
    if current_user["role"] == "teacher":
        taught_courses = await get_database()["courses"].distinct("_id", {"teacher_id": current_user["_id"]})
        match_stage["course_id"] = {"$in": taught_courses}

    pipeline = [
        {"$match": match_stage},
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
    ]
    items = await get_database()["attendance"].aggregate(pipeline).to_list(length=None)
    return {"items": items}
