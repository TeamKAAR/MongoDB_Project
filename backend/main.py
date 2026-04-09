from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.students.router import (
    ensure_demo_academic_records,
    ensure_demo_students,
    router as students_router,
)
from auth.router import ensure_demo_users, router as auth_router
from database import close_mongodb_connection, connect_to_mongodb, get_database


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    database: str
    collections: list[str]


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongodb()
    await ensure_demo_users()
    await ensure_demo_students()
    await ensure_demo_academic_records()
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
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(students_router)


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    database = get_database()

    return HealthResponse(
        status="ok",
        service="EduTrack backend",
        database=database.name,
        collections=["users", "students"],
    )
