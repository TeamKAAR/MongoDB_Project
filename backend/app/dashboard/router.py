from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth.permissions import require_roles
from database import get_database


router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


class StatCard(BaseModel):
    label: str
    value: float
    suffix: str = ""


class GradeDistributionItem(BaseModel):
    grade: str
    count: int


class EnrollmentTrendItem(BaseModel):
    label: str
    enrollments: int


class StudentLeaderboardItem(BaseModel):
    student_id: str
    student_name: str
    gpa: float


class AttendanceAlertItem(BaseModel):
    course_id: str
    course_name: str
    attendance_rate: float


class DashboardAnalyticsResponse(BaseModel):
    stats: list[StatCard]
    grade_distribution: list[GradeDistributionItem]
    enrollment_trends: list[EnrollmentTrendItem]
    top_students: list[StudentLeaderboardItem]
    attendance_alerts: list[AttendanceAlertItem]


def _month_start(reference: datetime, months_back: int) -> datetime:
    year = reference.year
    month = reference.month - months_back
    while month <= 0:
        month += 12
        year -= 1
    return datetime(year, month, 1, tzinfo=UTC)


@router.get("/analytics", response_model=DashboardAnalyticsResponse)
async def dashboard_analytics(
    current_user: dict = Depends(require_roles("admin", "teacher")),
) -> DashboardAnalyticsResponse:
    del current_user
    database = get_database()
    students = database["students"]
    courses = database["courses"]
    marks = database["marks"]
    attendance = database["attendance"]
    enrollments = database["enrollments"]

    total_students = await students.count_documents({})
    active_courses = await courses.count_documents({"status": "active"})

    gpa_rows = await marks.aggregate(
        [
            {"$group": {"_id": None, "average": {"$avg": "$gpa"}}},
        ]
    ).to_list(length=1)
    average_gpa = round(gpa_rows[0]["average"], 2) if gpa_rows else 0.0

    attendance_rows = await attendance.aggregate(
        [
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "present": {
                        "$sum": {
                            "$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]
                        }
                    },
                }
            }
        ]
    ).to_list(length=1)
    if attendance_rows and attendance_rows[0]["total"] > 0:
        average_attendance = round((attendance_rows[0]["present"] / attendance_rows[0]["total"]) * 100, 2)
    else:
        average_attendance = 0.0

    grade_rows = await marks.aggregate(
        [
            {"$group": {"_id": "$grade", "count": {"$sum": 1}}},
        ]
    ).to_list(length=None)
    grade_map = {row["_id"]: row["count"] for row in grade_rows if row.get("_id")}
    ordered_grades = ["A+", "A", "B", "C", "D", "F"]
    grade_distribution = [
        GradeDistributionItem(grade=grade, count=grade_map.get(grade, 0))
        for grade in ordered_grades
    ]

    now = datetime.now(UTC)
    first_month = _month_start(now, 5)
    trend_rows = await enrollments.aggregate(
        [
            {"$match": {"enrolled_at": {"$gte": first_month}}},
            {
                "$group": {
                    "_id": {
                        "year": {"$year": "$enrolled_at"},
                        "month": {"$month": "$enrolled_at"},
                    },
                    "count": {"$sum": 1},
                }
            },
        ]
    ).to_list(length=None)
    trend_map = {
        f"{row['_id']['year']:04d}-{row['_id']['month']:02d}": row["count"]
        for row in trend_rows
    }
    enrollment_trends: list[EnrollmentTrendItem] = []
    for months_back in range(5, -1, -1):
        month_start = _month_start(now, months_back)
        key = f"{month_start.year:04d}-{month_start.month:02d}"
        enrollment_trends.append(
            EnrollmentTrendItem(
                label=month_start.strftime("%b %Y"),
                enrollments=trend_map.get(key, 0),
            )
        )

    top_students_rows = await marks.aggregate(
        [
            {
                "$group": {
                    "_id": "$student_id",
                    "gpa": {"$avg": "$gpa"},
                }
            },
            {"$sort": {"gpa": -1}},
            {"$limit": 5},
            {
                "$lookup": {
                    "from": "students",
                    "localField": "_id",
                    "foreignField": "_id",
                    "as": "student",
                }
            },
            {"$unwind": "$student"},
            {
                "$project": {
                    "_id": 0,
                    "student_id": "$student.student_id",
                    "student_name": {"$concat": ["$student.name.first", " ", "$student.name.last"]},
                    "gpa": {"$round": ["$gpa", 2]},
                }
            },
        ]
    ).to_list(length=None)

    attendance_alert_rows = await attendance.aggregate(
        [
            {
                "$group": {
                    "_id": "$course_id",
                    "total": {"$sum": 1},
                    "present": {
                        "$sum": {
                            "$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]
                        }
                    },
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "attendance_rate": {
                        "$round": [
                            {
                                "$multiply": [
                                    {"$divide": ["$present", {"$max": ["$total", 1]}]},
                                    100,
                                ]
                            },
                            2,
                        ]
                    },
                }
            },
            {"$sort": {"attendance_rate": 1}},
            {"$limit": 5},
            {
                "$lookup": {
                    "from": "courses",
                    "localField": "_id",
                    "foreignField": "_id",
                    "as": "course",
                }
            },
            {"$unwind": "$course"},
            {
                "$project": {
                    "_id": 0,
                    "course_id": {"$toString": "$course._id"},
                    "course_name": "$course.name",
                    "attendance_rate": 1,
                }
            },
        ]
    ).to_list(length=None)

    return DashboardAnalyticsResponse(
        stats=[
            StatCard(label="Total Students", value=float(total_students)),
            StatCard(label="Courses", value=float(active_courses)),
            StatCard(label="Avg GPA", value=average_gpa, suffix="/ 4.0"),
            StatCard(label="Avg Attendance", value=average_attendance, suffix="%"),
        ],
        grade_distribution=grade_distribution,
        enrollment_trends=enrollment_trends,
        top_students=[StudentLeaderboardItem(**row) for row in top_students_rows],
        attendance_alerts=[AttendanceAlertItem(**row) for row in attendance_alert_rows],
    )
