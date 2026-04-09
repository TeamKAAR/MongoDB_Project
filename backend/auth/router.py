import os
from datetime import UTC, datetime, timedelta
from typing import Literal

import bcrypt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr

from database import get_users_collection


JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-backend-env")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

DEMO_USERS = [
    {
        "name": "Demo Admin",
        "email": "admin@edutrack.com",
        "password": "Admin@123",
        "role": "admin",
    },
    {
        "name": "Demo Teacher",
        "email": "teacher@edutrack.com",
        "password": "Teacher@123",
        "role": "teacher",
    },
    {
        "name": "Demo Student",
        "email": "student@edutrack.com",
        "password": "Student@123",
        "role": "student",
    },
]

security = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Literal["admin", "teacher", "student"]
    is_active: bool
    created_at: datetime


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    user: UserResponse


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: str, role: str) -> str:
    expires_at = datetime.now(UTC) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "role": role,
        "exp": expires_at,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def to_user_response(user: dict) -> UserResponse:
    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        role=user["role"],
        is_active=user["is_active"],
        created_at=user["created_at"],
    )


async def ensure_demo_users() -> None:
    users = get_users_collection()

    for demo_user in DEMO_USERS:
        await users.update_one(
            {"email": demo_user["email"]},
            {
                "$setOnInsert": {
                    "name": demo_user["name"],
                    "email": demo_user["email"],
                    "password_hash": hash_password(demo_user["password"]),
                    "role": demo_user["role"],
                    "created_at": datetime.now(UTC),
                    "is_active": True,
                }
            },
            upsert=True,
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        ) from exc

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    user = await get_users_collection().find_one({"_id": ObjectId(user_id)})

    if user is None or not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer has access.",
        )

    return user


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    user = await get_users_collection().find_one({"email": payload.email})

    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.get("is_active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is inactive.",
        )

    access_token = create_access_token(str(user["_id"]), user["role"])

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=JWT_EXPIRE_HOURS * 60 * 60,
        user=to_user_response(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    return to_user_response(current_user)
