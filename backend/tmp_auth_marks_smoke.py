import asyncio

import httpx

from main import app


async def login(client: httpx.AsyncClient, email: str, password: str) -> tuple[dict, dict[str, str]]:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    return payload["user"], {"Authorization": f"Bearer {payload['access_token']}"}


async def main() -> None:
    transport = httpx.ASGITransport(app=app)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            admin_user, admin_headers = await login(client, "admin@edutrack.com", "Admin@123")
            teacher_user, teacher_headers = await login(client, "teacher@edutrack.com", "Teacher@123")
            student_user, student_headers = await login(client, "student@edutrack.com", "Student@123")

            students_response = await client.get("/api/v1/students?limit=10&status=active", headers=admin_headers)
            assert students_response.status_code == 200, students_response.text
            students_payload = students_response.json()["items"]
            linked_student_id = student_user["student_profile_id"]
            other_student_id = next(item["id"] for item in students_payload if item["id"] != linked_student_id)

            courses_response = await client.get("/api/v1/courses", headers=admin_headers)
            assert courses_response.status_code == 200, courses_response.text
            course_id = courses_response.json()[0]["id"]

            course_marks = await client.get(f"/api/v1/marks/course/{course_id}", headers=admin_headers)
            assert course_marks.status_code == 200, course_marks.text

            teacher_course_marks = await client.get(
                f"/api/v1/marks/course/{course_id}",
                headers=teacher_headers,
            )
            assert teacher_course_marks.status_code == 200, teacher_course_marks.text

            own_marks = await client.get(
                f"/api/v1/marks/student/{linked_student_id}",
                headers=student_headers,
            )
            assert own_marks.status_code == 200, own_marks.text

            forbidden_marks = await client.get(
                f"/api/v1/marks/student/{other_student_id}",
                headers=student_headers,
            )
            assert forbidden_marks.status_code == 403, forbidden_marks.text

            forbidden_students = await client.get("/api/v1/students?limit=10", headers=student_headers)
            assert forbidden_students.status_code == 403, forbidden_students.text

            forbidden_create = await client.post(
                "/api/v1/marks",
                headers=student_headers,
                json={
                    "student_id": linked_student_id,
                    "course_id": course_id,
                    "assessment_type": "Quiz",
                    "assessment_name": "Unauthorized attempt",
                    "marks_obtained": 9,
                    "max_marks": 10,
                    "date": "2026-04-13T00:00:00Z",
                    "remarks": "",
                },
            )
            assert forbidden_create.status_code == 403, forbidden_create.text

            print(
                {
                    "admin_role": admin_user["role"],
                    "teacher_role": teacher_user["role"],
                    "student_role": student_user["role"],
                    "student_linked_profile": linked_student_id,
                    "course_marks_count": len(course_marks.json()),
                    "own_marks_count": len(own_marks.json()["items"]),
                }
            )


asyncio.run(main())
