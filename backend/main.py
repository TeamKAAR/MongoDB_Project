import json
import os
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.attendance.router import router as attendance_router
from app.courses.router import ensure_demo_courses, router as courses_router
from app.dashboard.router import router as dashboard_router
from app.enrollments.router import ensure_demo_enrollments, router as enrollments_router
from app.interactions.router import ensure_demo_interactions, router as interactions_router
from app.marks.router import router as marks_router
from app.mentorships.router import ensure_demo_mentorships, router as mentorships_router
from app.students.router import (
    ensure_demo_academic_records,
    ensure_demo_students,
    router as students_router,
)
from auth.router import ensure_demo_user_links, ensure_demo_users, router as auth_router
from database import close_mongodb_connection, connect_to_mongodb, get_database


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    database: str
    collections: list[str]


def _cors_origins() -> list[str]:
    raw_value = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    try:
        parsed = json.loads(raw_value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass

    return [origin.strip() for origin in raw_value.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongodb()
    await ensure_demo_users()
    await ensure_demo_students()
    await ensure_demo_user_links()
    await ensure_demo_courses()
    await ensure_demo_enrollments()
    await ensure_demo_academic_records()
    await ensure_demo_mentorships()
    await ensure_demo_interactions()
    app.state.database = get_database()

    try:
        yield
    finally:
        await close_mongodb_connection()


app = FastAPI(
    title="EduTrack API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(marks_router)
app.include_router(attendance_router)
app.include_router(courses_router)
app.include_router(enrollments_router)
app.include_router(students_router)
app.include_router(mentorships_router)
app.include_router(interactions_router)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    database = get_database()

    return HealthResponse(
        status="ok",
        service="EduTrack backend",
        database=database.name,
        collections=["users", "students", "courses", "enrollments", "marks", "attendance", "mentorships", "interactions"],
    )
