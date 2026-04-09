# ⚡ SPRINT.md — EduTrack Execution Playbook
### *The vibe coder's guide to shipping this thing, start to finish*

> **Read this first.** This file tells you exactly what to build, in what order, and what "done" looks like for each piece. No guessing. Just code.

---

## 🗺️ The Big Picture

```
Sprint 0  →  Sprint 1  →  Sprint 2  →  Sprint 3  →  Sprint 4  →  Sprint 5
  Setup       Auth        Students     Courses      Marks +       Polish +
  & DB        System      CRUD         + Enroll     Attendance    Deploy
  (1 day)     (1 day)     (2 days)     (1 day)      (2 days)      (1 day)
```

**Total estimated time:** ~8 days for a solo dev vibe coding it  
**Stack recap:** React + Vite + shadcn/ui (frontend) · FastAPI + Python (backend) · MongoDB Atlas (DB)

---

## ✅ Global Definition of Done

Before marking ANY task done, make sure:
- [ ] Feature works end-to-end (not just the backend or just the UI)
- [ ] No `console.error` spam in browser
- [ ] No Python traceback in terminal
- [ ] Toast notification shows on success AND error
- [ ] Loading states exist (spinner, skeleton, or disabled button)
- [ ] Works on mobile width (375px)

---

---

# 🏁 SPRINT 0 — Environment Setup & Database
### *Goal: Get the project running locally. Zero features, just green lights.*
**Time:** ~4 hours | **Vibe:** coffee + setup playlist ☕

---

## 0.1 — MongoDB Atlas Cluster

**What to do:**
- [ ] Go to [mongodb.com/atlas](https://mongodb.com/atlas) → Sign up free
- [ ] Create a **Free M0 cluster** (pick region closest to you)
- [ ] Go to **Database Access** → Add user: `edutrack_user` / pick a strong password
- [ ] Go to **Network Access** → Add IP: `0.0.0.0/0` (allow all — fine for dev)
- [ ] Hit **Connect** → **Drivers** → copy the connection string
- [ ] It looks like: `mongodb+srv://edutrack_user:<password>@cluster0.xxxxx.mongodb.net/`

**Done when:** You have a working connection string saved somewhere

---

## 0.2 — Backend Setup

```bash
# From project root
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Open .env and paste your MongoDB URI + set JWT_SECRET to any random string
```

**Then test it:**
```bash
uvicorn app.main:app --reload --port 8000
# Open: http://localhost:8000/health
# Should see: {"status":"ok","service":"EduTrack API v1.0.0"}
# Also open: http://localhost:8000/docs  ← auto-generated Swagger UI 🔥
```

**Done when:** `/health` returns 200 and `/docs` loads

---

## 0.3 — Seed the Database

```bash
# With venv still active, from /backend
python scripts/seed_data.py

# You should see:
# ✅ Created 3 users
# ✅ Created 5 courses
# ✅ Created 12 students
# ✅ Created ~36 enrollments
# ✅ Created ~144 mark records
# ✅ Created ~500+ attendance records
# 🎉 Database seeded successfully!
```

**Done when:** All green checkmarks printed, no Python errors

---

## 0.4 — Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# .env should have: VITE_API_URL=http://localhost:8000
npm run dev
# Opens: http://localhost:5173
```

**Done when:** Vite dev server starts (even if it shows a blank/error page — that's fine for now)

---

## 0.5 — Verify the Stack Talks to Each Other

```bash
# In one terminal: backend
cd backend && uvicorn app.main:app --reload --port 8000

# In another terminal: frontend  
cd frontend && npm run dev
```

Open browser → `http://localhost:5173`  
Open Network tab → no CORS errors on requests to `localhost:8000`

**Done when:** No CORS errors. Stack is connected.

---

## Sprint 0 Checklist
```
[ ] MongoDB Atlas cluster created + connection string saved
[ ] Backend runs on :8000, /health returns 200
[ ] /docs Swagger UI loads
[ ] Seed script ran successfully (12 students, 5 courses, etc.)
[ ] Frontend dev server runs on :5173
[ ] No CORS errors in browser console
```

---
---

# 🔐 SPRINT 1 — Authentication
### *Goal: Login page works. JWT stored. Protected routes block unauthenticated users.*
**Time:** ~6 hours | **Vibe:** focused, no distractions 🎯

---

## 1.1 — Backend: Auth Routes Already Built ✅

The auth backend is already written. Just verify these endpoints work in Swagger (`/docs`):

- [ ] `POST /api/v1/auth/login` → try `{"email":"admin@edutrack.com","password":"Admin@123"}` → should return a JWT
- [ ] `POST /api/v1/auth/register` → create a new user, should return success
- [ ] `GET /api/v1/auth/me` → use the JWT from login, should return user info

**If any fail:** Check your `.env` has correct `MONGODB_URI` and `JWT_SECRET`

---

## 1.2 — Frontend: Login Page

File: `src/pages/LoginPage.jsx` ← already scaffolded

**What it needs to do:**
- [ ] Email + password form
- [ ] "Show/hide password" eye icon toggle
- [ ] Three demo buttons (Admin / Teacher / Student) that auto-fill the form
- [ ] On submit → `POST /api/v1/auth/login` → save token + user to `localStorage` + Zustand store
- [ ] Redirect to `/dashboard` on success
- [ ] Show toast error on bad credentials
- [ ] Loading spinner on the button while submitting

**Test it:**
1. Click "admin" demo button → form fills
2. Click "Sign in" → redirects to dashboard
3. Try wrong password → shows error toast
4. Refresh page → stays on dashboard (token persisted)

---

## 1.3 — Frontend: Protected Routes

File: `src/App.jsx` ← already has `<ProtectedRoute>` wrapper

**What it does:**
- [ ] If no token in localStorage → redirect to `/login`
- [ ] If token exists → render the page

**Test it:**
1. Clear localStorage → visit `/dashboard` → should redirect to `/login`
2. Log in → visit `/dashboard` → should load normally

---

## 1.4 — Frontend: Auth Store (Zustand)

File: `src/store/authStore.js` ← already written

Verify:
- [ ] `useAuthStore().user` has name, email, role after login
- [ ] `logout()` clears localStorage AND redirects to `/login`
- [ ] Sidebar shows user's name and role

---

## 1.5 — Frontend: Layout + Sidebar

File: `src/components/layout/Layout.jsx` ← already scaffolded

**Check:**
- [ ] Sidebar shows all 5 nav items: Dashboard, Students, Courses, Marks & Grades, Attendance
- [ ] Active nav item is highlighted
- [ ] User avatar/name/role shows at the bottom of sidebar
- [ ] Logout button works
- [ ] On mobile: sidebar is hidden, hamburger menu opens it

---

## Sprint 1 Checklist
```
[ ] Login with admin@edutrack.com / Admin@123 works
[ ] JWT saved to localStorage after login
[ ] /dashboard redirects to /login when not authenticated
[ ] Logout clears session and goes to /login
[ ] Sidebar renders with all nav links
[ ] Mobile hamburger menu works
[ ] Role shown in sidebar footer (admin / teacher / student)
```

---
---

# 👨‍🎓 SPRINT 2 — Students Module
### *Goal: Full CRUD for students. Table, search, filter, add/edit/delete, profile page.*
**Time:** ~2 days | **Vibe:** this is the biggest sprint 💪

---

## 2.1 — Backend: Students API ✅

Already written in `app/students/router.py`. Verify in Swagger:

- [ ] `GET /api/v1/students` → returns paginated list (should show 12 students)
- [ ] `GET /api/v1/students?search=aarav` → filters by name
- [ ] `GET /api/v1/students?status=active` → filters by status
- [ ] `POST /api/v1/students` → creates new student (test with Swagger, send JSON body)
- [ ] `GET /api/v1/students/:id` → get one student
- [ ] `PUT /api/v1/students/:id` → update student
- [ ] `DELETE /api/v1/students/:id` → soft-deletes (sets status to inactive)

---

## 2.2 — Frontend: Students List Page

File: `src/pages/StudentsPage.jsx`

**What to build:**

**Header section:**
- [ ] Page title "Students" + subtitle
- [ ] "Add Student" button (opens modal)
- [ ] Search bar (debounced, 300ms — searches as you type)
- [ ] Status filter dropdown (All / Active / Inactive / Graduated)

**Table:**
- [ ] Columns: Avatar + Name, Student ID, Email, Phone, Status, Enrolled Date, Actions
- [ ] Avatar: colored circle with initials (use `initials()` + `avatarColor()` from utils)
- [ ] Status: colored badge (green=active, red=inactive, blue=graduated)
- [ ] Actions: View 👁️ / Edit ✏️ / Delete 🗑️ icons

**Pagination:**
- [ ] Previous / Next buttons
- [ ] "Showing X–Y of Z students" text
- [ ] 20 students per page

**Loading state:**
- [ ] Skeleton rows while fetching (or a centered spinner)

**Empty state:**
- [ ] "No students found" illustration/text when search returns nothing

---

## 2.3 — Frontend: Student Form Modal

File: Part of `StudentsPage.jsx` or `components/students/StudentModal.jsx`

**Fields (all in a drawer/modal):**
- [ ] First Name + Last Name (2 columns)
- [ ] Email + Phone (2 columns)
- [ ] Gender dropdown + Date of Birth + Status (3 columns)
- [ ] Enrollment Date
- [ ] Address section: Street, City, State, Pincode (2x2 grid)

**Behavior:**
- [ ] Same modal for CREATE and EDIT (prop: `student` → if null, it's create mode)
- [ ] Pre-fills all fields when editing
- [ ] Shows "Student ID" as read-only when editing (e.g. STU-2024-0001)
- [ ] Submit calls correct API (POST for create, PUT for edit)
- [ ] On success: closes modal, refreshes list, shows success toast
- [ ] Validation: required fields highlighted, email format

---

## 2.4 — Frontend: Delete Student

- [ ] Click trash icon → show a confirmation dialog ("Are you sure? This will deactivate the student.")
- [ ] On confirm → `DELETE /api/v1/students/:id` → refresh list
- [ ] On success: toast "Student deactivated"

---

## 2.5 — Frontend: Student Profile Page

File: `src/pages/StudentProfilePage.jsx`

**Route:** `/students/:id`  
**Navigate here** by clicking the 👁️ view icon or student name in the table

**Sections to build:**

**Header card:**
- [ ] Large avatar (initials or photo)
- [ ] Full name, Student ID badge, status badge
- [ ] Email, phone, gender, DOB in a grid
- [ ] "Edit" button (opens same modal)

**Tabs (use shadcn Tabs or simple custom tabs):**

**Tab 1 — Enrolled Courses:**
- [ ] Call `GET /api/v1/enrollments/student/:id`
- [ ] Table: Course Code, Course Name, Credits, Enrolled Date
- [ ] Empty state if no enrollments

**Tab 2 — Marks & GPA:**
- [ ] Call `GET /api/v1/marks/student/:id`
- [ ] Table: Course, Assessment Type, Marks, Max Marks, %, Grade
- [ ] Grade colored by letter (A+=green, F=red)
- [ ] Summary card: Overall GPA + Average Percentage

**Tab 3 — Attendance:**
- [ ] Call `GET /api/v1/attendance/student/:id/summary`
- [ ] Cards per course: course name, total classes, present, absent, **percentage**
- [ ] Red warning badge if attendance < 75%
- [ ] Progress bar showing attendance %

---

## Sprint 2 Checklist
```
[ ] Students list loads with real data from API
[ ] Search by name/email works (debounced)
[ ] Status filter works
[ ] Pagination works (prev/next, page counter)
[ ] Create new student → appears in list
[ ] Edit student → changes saved + shown in list
[ ] Delete student → removed from list (status inactive)
[ ] Student profile page loads at /students/:id
[ ] Profile shows enrolled courses tab
[ ] Profile shows marks + GPA tab
[ ] Profile shows attendance summary tab with % bars
[ ] Low attendance (<75%) shows warning
[ ] Loading states on all async ops
[ ] Error toasts on API failures
```

---
---

# 📚 SPRINT 3 — Courses & Enrollment
### *Goal: CRUD for courses. Enroll/unenroll students. See who's in each course.*
**Time:** ~1 day | **Vibe:** getting into a rhythm 🎵

---

## 3.1 — Backend: Courses + Enrollments API ✅

Verify in Swagger:
- [ ] `GET /api/v1/courses` → returns list with `enrolled_count`
- [ ] `POST /api/v1/courses` → creates course
- [ ] `PUT /api/v1/courses/:id` → updates course
- [ ] `DELETE /api/v1/courses/:id` → archives course
- [ ] `POST /api/v1/enrollments` → `{"student_id":"...","course_id":"..."}`
- [ ] `DELETE /api/v1/enrollments/:studentId/:courseId` → unenrolls
- [ ] `GET /api/v1/enrollments/course/:courseId` → list of enrolled students

---

## 3.2 — Frontend: Courses Page

File: `src/pages/CoursesPage.jsx`

**Layout (card grid, not table):**
- [ ] "Add Course" button in header
- [ ] Course cards in a 3-column responsive grid

**Each Course Card shows:**
- [ ] Course code badge (e.g. `CS101`) in top-right corner
- [ ] Course name (bold, large)
- [ ] Teacher name with a person icon
- [ ] Credits badge + Schedule (days + time)
- [ ] Enrolled: `24 / 40` with a mini progress bar
- [ ] Room number
- [ ] Edit + Archive action buttons

---

## 3.3 — Frontend: Course Form Modal

- [ ] Fields: Course Code, Name, Description, Credits, Teacher Name, Capacity
- [ ] Schedule: Days (multi-select checkboxes: Mon/Tue/Wed/Thu/Fri) + Time + Room
- [ ] Create + Edit in same modal

---

## 3.4 — Frontend: Enrollment Management

**On the Course Card** or on a Course Detail page:
- [ ] "View Students" button → opens a panel/modal
- [ ] Shows list of enrolled students with names + student IDs
- [ ] "Enroll Student" button → searchable dropdown of students → click enroll
- [ ] Each student has an "Unenroll" button (with confirmation)

**Also on the Student Profile (Tab 1):**
- [ ] "Enroll in Course" button → dropdown of available courses → click Enroll
- [ ] Enrolled courses list updates instantly

---

## Sprint 3 Checklist
```
[ ] Courses page loads as card grid with real data
[ ] Each card shows enrolled count + capacity progress bar
[ ] Create course → appears in grid
[ ] Edit course → card updates
[ ] Archive course → card disappears
[ ] Enroll student in a course (from course view)
[ ] Unenroll student (with confirmation)
[ ] Enrolled courses show on Student Profile tab
```

---
---

# 📊 SPRINT 4 — Marks & Attendance
### *Goal: Teachers can record grades and take attendance. Reports show accurate data.*
**Time:** ~2 days | **Vibe:** the meat of the product 🥩

---

## 4.1 — Backend: Marks + Attendance APIs ✅

Verify in Swagger:
- [ ] `POST /api/v1/marks` → add a mark (grade auto-calculated from marks_obtained/max_marks)
- [ ] `GET /api/v1/marks/student/:id` → student marks with summary
- [ ] `GET /api/v1/marks/course/:id` → all marks for a course
- [ ] `POST /api/v1/attendance` → mark one student attendance
- [ ] `POST /api/v1/attendance/bulk` → mark all students in a course at once
- [ ] `GET /api/v1/attendance/student/:id/summary` → % per course

---

## 4.2 — Frontend: Marks Page

File: `src/pages/MarksPage.jsx`

**Layout:**
- [ ] Two-panel or tabbed view: by Course | by Student

**"By Course" view:**
- [ ] Course selector dropdown (top)
- [ ] Once course selected → show student list with their marks
- [ ] Table columns: Student Name, Student ID, Assignment, Quiz, Midterm, Final, Avg %, Grade, GPA
- [ ] "Add / Edit Mark" button per student per assessment
- [ ] Grade cell colored (A+=green → F=red)

**"By Student" view:**
- [ ] Student search/select
- [ ] Shows all courses + assessments in a clean table
- [ ] GPA summary at top

**Add Mark Modal:**
- [ ] Fields: Student (pre-filled if from student view), Course, Assessment Type, Assessment Name, Marks Obtained, Max Marks, Date, Remarks
- [ ] Grade + GPA auto-shown as a preview as you type marks
- [ ] Submit → row updates in table

---

## 4.3 — Frontend: Attendance Page

File: `src/pages/AttendancePage.jsx`

**Layout:**

**Section 1 — Mark Attendance (for teachers):**
- [ ] Date picker (defaults to today)
- [ ] Course selector dropdown
- [ ] Once course + date selected → loads enrolled students
- [ ] Each student row has status selector: Present ✅ / Absent ❌ / Late 🕐 / Excused 📋
- [ ] Default all to "Present" (easy bulk mark)
- [ ] "Mark All Present" / "Mark All Absent" quick buttons at top
- [ ] Single "Save Attendance" button at bottom → calls bulk mark API
- [ ] Shows a "Already marked" indicator if attendance for that course+date exists

**Section 2 — Attendance Report:**
- [ ] Student selector
- [ ] Shows summary cards per course (total, present, absent, %)
- [ ] Color-coded: green ≥ 75%, orange 60–74%, red < 60%
- [ ] Detailed records table below: Date, Course, Status

---

## 4.4 — Grade Calculator Preview (nice touch 🎨)

Inside the Add Mark modal:
- [ ] As user types `marks_obtained` and `max_marks` → live preview updates:
  ```
  Percentage: 85%  →  Grade: A  →  GPA: 3.7
  ```
- [ ] The preview box changes color based on grade (green for A, red for F)

---

## Sprint 4 Checklist
```
[ ] Marks page loads, shows marks by course
[ ] Can add a new mark → grade/GPA auto-calculated
[ ] Grade preview shows live in modal as you type
[ ] Marks table color-codes grades correctly
[ ] Attendance page loads enrolled students for a course
[ ] Can mark individual students present/absent/late/excused
[ ] Bulk "Mark All Present" works
[ ] Save Attendance saves all records at once
[ ] Attendance report shows % per course per student
[ ] Low attendance (<75%) flagged in red
[ ] All loading states work
```

---
---

# 🚀 SPRINT 5 — Dashboard + Polish + Deploy
### *Goal: Dashboard charts work. UI is polished. Live on the internet.*
**Time:** ~1 day | **Vibe:** final stretch, make it shine ✨

---

## 5.1 — Dashboard Page

File: `src/pages/DashboardPage.jsx` ← already scaffolded

**Verify all stat cards pull real data:**
- [ ] Total Students → `data.total_students`
- [ ] Active Courses → `data.total_courses`
- [ ] Average GPA → `data.avg_gpa`
- [ ] Avg Attendance → `data.avg_attendance`

**Charts (using Recharts — already installed):**
- [ ] Grade Distribution → BarChart (grade on X, count on Y, colored bars per grade)
- [ ] Monthly Enrollments → LineChart (month on X, student count on Y)

**Tables:**
- [ ] Top 5 students by GPA (rank medal + name + GPA)
- [ ] System overview: enrollments, GPA, attendance with progress bar

**Test:** All numbers match what's actually in the database (cross-check with Swagger)

---

## 5.2 — UI Polish Pass

Go through every page and check:

**Consistency:**
- [ ] All buttons use `.btn-primary`, `.btn-secondary`, `.btn-danger` classes
- [ ] All forms use `.form-input`, `.form-label`, `.form-select`
- [ ] All modals have X close button + click-outside-to-close
- [ ] All tables have hover row highlight
- [ ] Empty states have a helpful message (not just blank space)

**Feedback:**
- [ ] Every create/edit/delete shows a toast
- [ ] Every API call has a loading indicator
- [ ] 404-style pages redirect to dashboard

**Mobile:**
- [ ] Sidebar collapses on mobile, hamburger works
- [ ] Tables scroll horizontally on small screens
- [ ] Modals are scrollable on small screens
- [ ] Stat cards stack to single column on mobile

---

## 5.3 — Deploy: MongoDB Atlas

Already done in Sprint 0. Just make sure:
- [ ] Network access allows `0.0.0.0/0` (for Render.com's dynamic IPs)
- [ ] Note your `MONGODB_URI` for the next step

---

## 5.4 — Deploy: Backend to Render.com

1. Push everything to GitHub (make sure `.env` is in `.gitignore`!)
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Settings:
   ```
   Root Directory: backend
   Runtime: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
5. Environment Variables (add these in the Render dashboard):
   ```
   MONGODB_URI    = mongodb+srv://...
   JWT_SECRET     = any-long-random-string-here
   CORS_ORIGINS   = ["https://YOUR-APP.vercel.app"]
   ```
6. Hit Deploy → wait 2–3 minutes
7. Test: `https://your-app.onrender.com/health` → should return `{"status":"ok"}`

> ⚠️ **Free Render note:** The instance sleeps after 15 min of no traffic. First request after sleep takes ~30s. This is fine for demo/school projects.

---

## 5.5 — Deploy: Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Settings:
   ```
   Framework Preset: Vite
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: dist
   ```
4. Environment Variables:
   ```
   VITE_API_URL = https://your-backend.onrender.com
   ```
5. Deploy → get your live URL (e.g. `https://edutrack.vercel.app`)

---

## 5.6 — Post-Deploy Smoke Test

Open your live Vercel URL and test end-to-end:
- [ ] Login works with `admin@edutrack.com` / `Admin@123`
- [ ] Dashboard loads with real data + charts
- [ ] Students page loads (12 students from seed)
- [ ] Can create a new student
- [ ] Courses page shows 5 courses
- [ ] Marks page shows grade data
- [ ] Attendance page loads enrolled students
- [ ] Logout works → back to login

---

## Sprint 5 Checklist
```
[ ] Dashboard all 4 stat cards show real numbers
[ ] Grade distribution bar chart renders correctly
[ ] Monthly enrollment line chart renders
[ ] Top 5 students table shows
[ ] All pages have consistent button/form styling
[ ] Mobile layout works (test at 375px width)
[ ] Backend live on Render, /health returns 200
[ ] Frontend live on Vercel
[ ] CORS_ORIGINS updated with Vercel URL
[ ] End-to-end smoke test passed (login → dashboard → students → logout)
```

---
---

# 🐛 Common Issues & Fixes

| Problem | Fix |
|---------|-----|
| CORS error in browser | Update `CORS_ORIGINS` in backend `.env` to include your frontend URL |
| 401 Unauthorized | Token expired or not sent — check axios interceptor adds `Authorization: Bearer ...` header |
| MongoDB connection refused | Check `MONGODB_URI` in `.env`, check Atlas Network Access allows your IP |
| Seed script fails with duplicate key | Run `python scripts/seed_data.py` again — it drops collections first |
| Render deployment fails | Check `requirements.txt` has all packages, check build logs |
| Vite build fails | Run `npm run build` locally first to see exact error |
| Charts show empty | Dashboard API returning empty arrays — check seed ran, check Atlas has data |
| Attendance % always 0 | Check seed ran, confirm `status` values are `"present"` not `"Present"` |
| FastAPI shows 422 error | Pydantic validation failed — check request body matches expected fields |
| React Router blank page on Vercel | Add `vercel.json`: `{"rewrites":[{"source":"/(.*)", "destination":"/index.html"}]}` |

---

# 📁 File Map Quick Reference

```
frontend/src/
├── pages/
│   ├── LoginPage.jsx         ← Sprint 1
│   ├── DashboardPage.jsx     ← Sprint 5
│   ├── StudentsPage.jsx      ← Sprint 2
│   ├── StudentProfilePage.jsx← Sprint 2
│   ├── CoursesPage.jsx       ← Sprint 3
│   ├── MarksPage.jsx         ← Sprint 4
│   └── AttendancePage.jsx    ← Sprint 4
├── components/layout/
│   └── Layout.jsx            ← Sprint 1
├── api/index.js              ← All API calls
├── store/authStore.js        ← Auth state
└── lib/utils.js              ← Helpers

backend/app/
├── main.py                   ← FastAPI entry
├── auth/router.py            ← Sprint 1
├── students/router.py        ← Sprint 2
├── courses/router.py         ← Sprint 3
├── enrollments/router.py     ← Sprint 3
├── marks/router.py           ← Sprint 4
├── attendance/router.py      ← Sprint 4
└── dashboard/router.py       ← Sprint 5
```

---

# 🎯 MVP vs Nice-to-Have

**Must ship (MVP):**
- ✅ Auth (login/logout/roles)
- ✅ Students CRUD + search + pagination
- ✅ Student profile with marks + attendance tabs
- ✅ Courses CRUD + enrollment
- ✅ Marks entry + grade auto-calc
- ✅ Attendance marking (bulk)
- ✅ Dashboard with stats + charts

**Nice-to-have (after MVP):**
- ⭐ Export CSV / PDF reports
- ⭐ Email notifications for low attendance
- ⭐ Dark mode toggle
- ⭐ Student photo upload
- ⭐ Course-wise analytics page
- ⭐ Register page for self-signup

---

> **You've got this. Start with Sprint 0, don't skip steps, and ship it. 🚀**