import asyncio
import json

import httpx

from main import app


async def run() -> None:
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

            analytics = await client.get("/api/v1/dashboard/analytics", headers=headers)
            assert analytics.status_code == 200, analytics.text
            payload = analytics.json()
            assert len(payload["stats"]) == 4, payload
            assert len(payload["enrollment_trends"]) == 6, payload

            health = await client.get("/health")
            assert health.status_code == 200, health.text

            print(
                json.dumps(
                    {
                        "stats": payload["stats"],
                        "grade_points": len(payload["grade_distribution"]),
                        "trend_points": len(payload["enrollment_trends"]),
                        "collections": health.json()["collections"],
                    }
                )
            )


asyncio.run(run())
