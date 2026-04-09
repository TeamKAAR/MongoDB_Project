# 🏗️ Architecture Document
## EduTrack — Student Management SaaS Platform

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│                                                              │
│   React + Vite SPA                                           │
│   shadcn/ui · Tailwind CSS · Recharts · Axios               │
│   Hosted on: Vercel (free)                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS REST API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                       API LAYER                              │
│                                                              │
│   FastAPI (Python 3.11)                                      │
│   Pydantic v2 · Motor (async) · python-jose · bcrypt        │
│   Hosted on: Render.com (free tier)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ Motor Async Driver
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│                                                              │
│   MongoDB Atlas (M0 Free Cluster)                            │
│   Collections: users, students, courses,                     │
│                enrollments, marks, attendance                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Repository Structure

```
edutrack/
├── frontend/                   # React + Vite App
│   ├── public/
│   ├── src/
│   │   ├── api/                # axios instance + API functions
│   │   │   ├── axiosClient.js
│   │   │   ├── authApi.js
│   │   │   ├── studentsApi.js
│   │   │   ├── coursesApi.js
│   │   │   ├── marksApi.js
│   │   │   └── attendanceApi.js
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui generated components
│   │   │   ├── layout/         # Sidebar, Topbar, PageWrapper
│   │   │   ├── students/       # StudentTable, StudentForm, etc.
│   │   │   ├── courses/
│   │   │   ├── marks/
│   │   │   ├── attendance/
│   │   │   └── dashboard/      # Charts, StatCards
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── StudentsPage.jsx
│   │   │   ├── StudentProfilePage.jsx
│   │   │   ├── CoursesPage.jsx
│   │   │   ├── MarksPage.jsx
│   │   │   └── AttendancePage.jsx
│   │   ├── hooks/              # useStudents, useCourses, etc.
│   │   ├── store/              # Zustand global state
│   │   │   ├── authStore.js
│   │   │   └── uiStore.js
│   │   ├── lib/                # utils, cn helper
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── backend/                    # FastAPI Python App
│   ├── app/
│   │   ├── main.py             # FastAPI app init, CORS, routers
│   │   ├── config.py           # Settings (pydantic BaseSettings)
│   │   ├── database.py         # MongoDB Motor connection
│   │   ├── auth/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   ├── models.py
│   │   │   └── deps.py         # get_current_user dependency
│   │   ├── students/
│   │   │   ├── router.py
│   │   │   ├── service.py
│   │   │   └── models.py
│   │   ├── courses/
│   │   ├── enrollments/
│   │   ├── marks/
│   │   ├── attendance/
│   │   └── dashboard/
│   ├── scripts/
│   │   └── seed_data.py        # Insert 10+ sample documents
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── docs/
│   ├── SDD.md
│   ├── FDD.md
│   ├── Architecture.md
│   └── DEPLOYMENT.md
│
└── README.md
```

---

## 3. MongoDB Schema Design

### Collection: `users`
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string (unique)",
  "password_hash": "string",
  "role": "admin | teacher | student",
  "created_at": "datetime",
  "is_active": "boolean"
}
```

### Collection: `students`
```json
{
  "_id": "ObjectId",
  "student_id": "STU-2024-0001",
  "name": { "first": "string", "last": "string" },
  "email": "string (unique)",
  "phone": "string",
  "date_of_birth": "datetime",
  "gender": "Male | Female | Other",
  "address": {
    "street": "string",
    "city": "string",
    "state": "string",
    "pincode": "string"
  },
  "enrollment_date": "datetime",
  "status": "active | inactive | graduated",
  "profile_image": "string (url)",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Collection: `courses`
```json
{
  "_id": "ObjectId",
  "course_code": "CS101",
  "name": "string",
  "description": "string",
  "credits": "number",
  "teacher_id": "ObjectId (ref: users)",
  "schedule": {
    "days": ["Monday", "Wednesday"],
    "time": "10:00 AM",
    "room": "A-201"
  },
  "capacity": "number",
  "status": "active | archived",
  "created_at": "datetime"
}
```

### Collection: `enrollments`
```json
{
  "_id": "ObjectId",
  "student_id": "ObjectId (ref: students)",
  "course_id": "ObjectId (ref: courses)",
  "enrolled_at": "datetime",
  "status": "active | dropped | completed"
}
```

### Collection: `marks`
```json
{
  "_id": "ObjectId",
  "student_id": "ObjectId (ref: students)",
  "course_id": "ObjectId (ref: courses)",
  "assessment_type": "quiz | midterm | final | assignment",
  "assessment_name": "string",
  "marks_obtained": "number",
  "max_marks": "number",
  "percentage": "number",
  "grade": "A+ | A | B | C | D | F",
  "gpa_points": "number",
  "date": "datetime",
  "remarks": "string",
  "created_at": "datetime"
}
```

### Collection: `attendance`
```json
{
  "_id": "ObjectId",
  "student_id": "ObjectId (ref: students)",
  "course_id": "ObjectId (ref: courses)",
  "date": "datetime",
  "status": "present | absent | late | excused",
  "marked_by": "ObjectId (ref: users)",
  "created_at": "datetime"
}
```

---

## 4. Key MongoDB Queries

```javascript
// 1. Get all students with active status
db.students.find({ status: "active" }).sort({ "name.first": 1 })

// 2. Get all courses a student is enrolled in
db.enrollments.aggregate([
  { $match: { student_id: ObjectId("..."), status: "active" } },
  { $lookup: { from: "courses", localField: "course_id", foreignField: "_id", as: "course" } },
  { $unwind: "$course" }
])

// 3. Get marks summary per student
db.marks.aggregate([
  { $match: { student_id: ObjectId("...") } },
  { $group: { _id: "$course_id", avg_marks: { $avg: "$percentage" }, avg_gpa: { $avg: "$gpa_points" } } }
])

// 4. Get attendance percentage per student per course
db.attendance.aggregate([
  { $match: { student_id: ObjectId("..."), course_id: ObjectId("...") } },
  { $group: {
    _id: null,
    total: { $sum: 1 },
    present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } }
  }},
  { $project: { percentage: { $multiply: [{ $divide: ["$present", "$total"] }, 100] } } }
])

// 5. Dashboard: Count students by status
db.students.aggregate([
  { $group: { _id: "$status", count: { $sum: 1 } } }
])

// 6. Top 5 students by average GPA
db.marks.aggregate([
  { $group: { _id: "$student_id", avg_gpa: { $avg: "$gpa_points" } } },
  { $sort: { avg_gpa: -1 } },
  { $limit: 5 },
  { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } }
])

// 7. Students with attendance < 75%
db.attendance.aggregate([
  { $group: {
    _id: { student_id: "$student_id", course_id: "$course_id" },
    total: { $sum: 1 },
    present: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } }
  }},
  { $project: { pct: { $multiply: [{ $divide: ["$present", "$total"] }, 100] } } },
  { $match: { pct: { $lt: 75 } } }
])

// 8. Grade distribution for a course
db.marks.aggregate([
  { $match: { course_id: ObjectId("..."), assessment_type: "final" } },
  { $group: { _id: "$grade", count: { $sum: 1 } } }
])

// 9. Students enrolled in more than 3 courses
db.enrollments.aggregate([
  { $match: { status: "active" } },
  { $group: { _id: "$student_id", course_count: { $sum: 1 } } },
  { $match: { course_count: { $gt: 3 } } }
])

// 10. Monthly enrollment trend
db.students.aggregate([
  { $group: { _id: { $month: "$enrollment_date" }, count: { $sum: 1 } } },
  { $sort: { "_id": 1 } }
])
```

---

## 5. Deployment Architecture

```
GitHub Repo
    │
    ├── frontend/ ──► Vercel
    │                  (auto-deploy on push to main)
    │                  env: VITE_API_URL=https://edutrack-api.onrender.com
    │
    └── backend/ ──► Render.com
                      (Docker deploy or Python env)
                      env: MONGODB_URI, JWT_SECRET
                           └──► MongoDB Atlas (M0 free)
```

---

## 6. Environment Variables

### Backend `.env`
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/edutrack
JWT_SECRET=your-super-secret-key-change-this
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24
CORS_ORIGINS=["https://edutrack.vercel.app","http://localhost:5173"]
```

### Frontend `.env`
```env
VITE_API_URL=http://localhost:8000
```