import asyncio
from datetime import datetime, timezone

import httpx

from main import app


async def main() -> None:
    transport = httpx.ASGITransport(app=app)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            login = await client.post(
                "/api/v1/auth/login",
                json={"email": "admin@edutrack.com", "password": "Admin@123"},
            )
            assert login.status_code == 200, login.text
            token = login.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            students = await client.get("/api/v1/students?limit=1&status=active", headers=headers)
            assert students.status_code == 200, students.text
            student = students.json()["items"][0]

            courses = await client.get("/api/v1/courses", headers=headers)
            assert courses.status_code == 200, courses.text
            course = next(item for item in courses.json() if item["status"] == "active")

            enrollments = await client.get(f"/api/v1/enrollments/course/{course['id']}", headers=headers)
            assert enrollments.status_code == 200, enrollments.text
            if not any(row["student_id"] == student["id"] for row in enrollments.json()):
                created = await client.post(
                    "/api/v1/enrollments",
                    headers=headers,
                    json={"student_id": student["id"], "course_id": course["id"]},
                )
                assert created.status_code in (200, 201), created.text

            mark_payload = {
                "student_id": student["id"],
                "course_id": course["id"],
                "assessment_type": "Quiz",
                "assessment_name": "Sprint 4 Verification Quiz",
                "marks_obtained": 45,
                "max_marks": 50,
                "date": datetime(2026, 4, 9, tzinfo=timezone.utc).isoformat(),
                "remarks": "smoke test",
            }
            mark = await client.post("/api/v1/marks", headers=headers, json=mark_payload)
            assert mark.status_code == 201, mark.text
            mark_body = mark.json()
            assert mark_body["grade"] == "A+", mark_body
            assert mark_body["gpa"] == 4.0, mark_body

            student_marks = await client.get(f"/api/v1/marks/student/{student['id']}", headers=headers)
            assert student_marks.status_code == 200, student_marks.text
            assert any(
                item["assessment_name"] == "Sprint 4 Verification Quiz"
                for item in student_marks.json()["items"]
            )

            course_marks = await client.get(f"/api/v1/marks/course/{course['id']}", headers=headers)
            assert course_marks.status_code == 200, course_marks.text
            assert any(
                item["assessment_name"] == "Sprint 4 Verification Quiz" for item in course_marks.json()
            )

            current_enrollments = (
                await client.get(f"/api/v1/enrollments/course/{course['id']}", headers=headers)
            ).json()
            attendance_payload = {
                "course_id": course["id"],
                "date": datetime(2026, 4, 9, tzinfo=timezone.utc).isoformat(),
                "items": [
                    {"student_id": row["student_id"], "status": "present"} for row in current_enrollments
                ],
            }
            bulk = await client.post("/api/v1/attendance/bulk", headers=headers, json=attendance_payload)
            assert bulk.status_code == 201, bulk.text
            assert len(bulk.json()) == len(attendance_payload["items"])

            summary = await client.get(f"/api/v1/attendance/student/{student['id']}/summary", headers=headers)
            assert summary.status_code == 200, summary.text
            assert any(item["course_id"] == course["id"] for item in summary.json()), summary.text

    print("Backend smoke test passed for marks and attendance.")


asyncio.run(main())
