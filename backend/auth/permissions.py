from typing import Literal

from bson import ObjectId
from fastapi import Depends, HTTPException, status

from auth.router import get_current_user
from database import get_courses_collection, get_enrollments_collection


UserRole = Literal["admin", "teacher", "student"]


def _forbidden(detail: str = "You do not have permission to perform this action.") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def require_roles(*allowed_roles: UserRole):
    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise _forbidden()
        return current_user

    return dependency


def get_linked_student_object_id(current_user: dict) -> ObjectId | None:
    raw_value = current_user.get("student_profile_id")
    if raw_value is None:
        return None

    raw_string = str(raw_value)
    if not ObjectId.is_valid(raw_string):
        return None

    return ObjectId(raw_string)


async def get_teacher_course_ids(current_user: dict) -> list[ObjectId]:
    if current_user["role"] != "teacher":
        return []

    rows = await get_courses_collection().find(
        {"teacher_id": current_user["_id"]},
        projection={"_id": 1},
    ).to_list(length=None)
    return [row["_id"] for row in rows]


async def ensure_course_access(current_user: dict, course_object_id: ObjectId) -> None:
    if current_user["role"] == "admin":
        return

    if current_user["role"] == "teacher":
        course = await get_courses_collection().find_one(
            {"_id": course_object_id},
            projection={"teacher_id": 1},
        )
        if course is not None and course.get("teacher_id") == current_user["_id"]:
            return
        raise _forbidden("Teachers can only access their assigned classes.")

    raise _forbidden()


async def ensure_student_access(current_user: dict, student_object_id: ObjectId) -> None:
    if current_user["role"] == "admin":
        return

    if current_user["role"] == "student":
        linked_student_id = get_linked_student_object_id(current_user)
        if linked_student_id is not None and linked_student_id == student_object_id:
            return
        raise _forbidden("Students can only access their own records.")

    if current_user["role"] == "teacher":
        teacher_course_ids = await get_teacher_course_ids(current_user)
        if not teacher_course_ids:
            raise _forbidden("Teachers can only access students in assigned classes.")

        enrollment = await get_enrollments_collection().find_one(
            {
                "student_id": student_object_id,
                "course_id": {"$in": teacher_course_ids},
                "status": "active",
            },
            projection={"_id": 1},
        )
        if enrollment is not None:
            return
        raise _forbidden("Teachers can only access students in assigned classes.")

    raise _forbidden()


async def build_student_scope_query(current_user: dict, base_query: dict | None = None) -> dict:
    query = dict(base_query or {})

    if current_user["role"] == "admin":
        return query

    if current_user["role"] == "teacher":
        teacher_course_ids = await get_teacher_course_ids(current_user)
        student_ids = await get_enrollments_collection().distinct(
            "student_id",
            {"course_id": {"$in": teacher_course_ids}, "status": "active"},
        )
        query["_id"] = {"$in": student_ids}
        return query

    if current_user["role"] == "student":
        linked_student_id = get_linked_student_object_id(current_user)
        if linked_student_id is None:
            raise _forbidden("Student account is not linked to a profile.")
        query["_id"] = linked_student_id
        return query

    raise _forbidden()


async def build_course_scope_query(current_user: dict, base_query: dict | None = None) -> dict:
    query = dict(base_query or {})

    if current_user["role"] == "admin":
        return query

    if current_user["role"] == "teacher":
        query["teacher_id"] = current_user["_id"]
        return query

    if current_user["role"] == "student":
        linked_student_id = get_linked_student_object_id(current_user)
        if linked_student_id is None:
            raise _forbidden("Student account is not linked to a profile.")
        course_ids = await get_enrollments_collection().distinct(
            "course_id",
            {"student_id": linked_student_id, "status": "active"},
        )
        query["_id"] = {"$in": course_ids}
        return query

    raise _forbidden()
