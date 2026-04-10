import os
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase


MONGODB_URL = os.getenv("MONGODB_URI") or os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "edutrack")


USER_SCHEMA: dict[str, Any] = {
    "_id": "ObjectId",
    "name": "string",
    "email": "string (unique)",
    "password_hash": "string",
    "role": "admin | teacher | student",
    "created_at": "datetime",
    "is_active": "boolean",
}

STUDENT_SCHEMA: dict[str, Any] = {
    "_id": "ObjectId",
    "student_id": "STU-2024-0001",
    "name": {"first": "string", "last": "string"},
    "email": "string (unique)",
    "phone": "string",
    "date_of_birth": "datetime",
    "gender": "Male | Female | Other",
    "address": {
        "street": "string",
        "city": "string",
        "state": "string",
        "pincode": "string",
    },
    "enrollment_date": "datetime",
    "status": "active | inactive | graduated",
    "profile_image": "string (url)",
    "created_at": "datetime",
    "updated_at": "datetime",
}

COURSE_SCHEMA: dict[str, Any] = {
    "_id": "ObjectId",
    "course_code": "CS101",
    "name": "string",
    "description": "string",
    "credits": "number",
    "teacher_id": "ObjectId (ref: users)",
    "schedule": {
        "days": ["Monday", "Wednesday"],
        "time": "10:00 AM",
        "room": "A-201",
    },
    "capacity": "number",
    "status": "active | archived",
    "created_at": "datetime",
}

ENROLLMENT_SCHEMA: dict[str, Any] = {
    "_id": "ObjectId",
    "student_id": "ObjectId (ref: students)",
    "course_id": "ObjectId (ref: courses)",
    "enrolled_at": "datetime",
    "status": "active | dropped | completed",
}


client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_to_mongodb() -> AsyncIOMotorDatabase:
    global client, database

    if database is not None:
        return database

    client = AsyncIOMotorClient(MONGODB_URL)
    await client.admin.command("ping")
    database = client[MONGODB_DB]

    await _ensure_indexes(database)
    return database


async def close_mongodb_connection() -> None:
    global client, database

    if client is not None:
        client.close()

    client = None
    database = None


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("MongoDB is not connected. Start the FastAPI app first.")

    return database


def get_users_collection() -> AsyncIOMotorCollection:
    return get_database()["users"]


def get_students_collection() -> AsyncIOMotorCollection:
    return get_database()["students"]


def get_courses_collection() -> AsyncIOMotorCollection:
    return get_database()["courses"]


def get_enrollments_collection() -> AsyncIOMotorCollection:
    return get_database()["enrollments"]


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db["users"].create_index("email", unique=True)
    await db["students"].create_index("email", unique=True)
    await db["students"].create_index("student_id", unique=True)
    await db["courses"].create_index("course_code", unique=True)
    await db["enrollments"].create_index(
        [("student_id", 1), ("course_id", 1)],
        unique=True,
        partialFilterExpression={"status": "active"},
    )
