This is a solid architectural foundation, Karthik. Since you're using a **"Vibe Coding"** approach (leveraging AI to generate the bulk of the logic while you orchestrate), the prompts need to be high-context, structural, and strict about the tech stack (FastAPI/Motor + React/shadcn).

Here are the optimized prompts for each sprint, designed to be pasted into your AI IDE (like Cursor, Windsurf, or Bolt).

---

## 🏎️ Sprint 0: The "Green Lights" Prompt
**Goal:** Establish the database connection and verify the backend-to-frontend handshake.

> **Prompt:**
> "I am building EduTrack using FastAPI, MongoDB (Motor), and React (Vite/shadcn). 
> 1. Reference `docs/Architecture.md` and `docs/SDD.md` for the stack details.
> 2. Initialize the FastAPI backend in `/backend`: set up `main.py` with a `/health` endpoint and configure MongoDB connection using Motor in `database.py`. 
> 3. Use the schema for `users` and `students` from `Architecture.md`.
> 4. Ensure CORS is configured to allow `http://localhost:5173`.
> 5. Create a basic Vite + React frontend in `/frontend` that fetches the `/health` status and displays it.
> 
> **How to Test Manually:**
> - Run `uvicorn app.main:app --reload` and visit `http://localhost:8000/docs`. Verify the health check returns 200.
> - Run `npm run dev` in the frontend and confirm the screen says 'API Status: Online'.
> - Check the browser console for any CORS errors."

---

## 🔐 Sprint 1: The "Gatekeeper" Prompt
**Goal:** Implement JWT Authentication and Protected Routes.

> **Prompt:**
> "Implement the Authentication system (F-01 in `docs/FDD.md`).
> 1. **Backend:** Create `auth/router.py`. Use `bcrypt` for password hashing and `python-jose` for JWT. Implement `/login` and `/me` endpoints.
> 2. **Frontend:** Set up a Zustand store in `src/store/authStore.js` to persist the JWT in `localStorage`. 
> 3. Create a `LoginPage.jsx` using shadcn/ui components. Include 'Demo' buttons for Admin, Teacher, and Student roles as specified in `sprints.md`.
> 4. Implement a `ProtectedRoute` component in React to redirect unauthenticated users to `/login`.
> 
> **How to Test Manually:**
> - Attempt to visit `/dashboard` while logged out; you should be redirected to `/login`.
> - Log in with the seed credentials (`admin@edutrack.com` / `Admin@123`).
> - Refresh the page; you should remain logged in.
> - Check `localStorage` in DevTools to see if the token is present."

---

## 👨‍🎓 Sprint 2: The "Data Heavy" Prompt
**Goal:** Full Student CRUD and Profile views.

> **Prompt:**
> "Build the Students Module (F-02 and F-08). 
> 1. **Backend:** Implement the Students CRUD in `app/students/router.py` with pagination, search (by name/ID), and status filtering.
> 2. **Frontend:** Create `StudentsPage.jsx` with a shadcn `Table`. Add a debounced search bar and a 'Status' filter.
> 3. Create `StudentFormModal.jsx` for both adding and editing students. Use the validation rules in `FDD.md` (e.g., DOB ≥ 15 years ago).
> 4. Create `StudentProfilePage.jsx` at `/students/:id` with tabs for 'Courses', 'Marks', and 'Attendance' as outlined in `sprints.md` section 2.5.
> 
> **How to Test Manually:**
> - Create a new student and verify they appear in the table.
> - Search for a specific name; the list should update after you stop typing (300ms).
> - Click a student's name to navigate to their profile and verify the URL contains their ID."

---

## 📚 Sprint 3: The "Relationship" Prompt
**Goal:** Courses and Enrollment logic.

> **Prompt:**
> "Implement Course Management and Enrollment (F-03 and F-04).
> 1. **Backend:** Create `courses` and `enrollments` routers. Ensure the course list returns an `enrolled_count`.
> 2. **Frontend:** Build `CoursesPage.jsx` using a responsive grid of shadcn `Cards`. Each card should show a progress bar for capacity (enrolled/max).
> 3. Add an 'Enroll' button that opens a searchable student dropdown. 
> 4. Ensure the Student Profile 'Courses' tab updates when a student is enrolled in a new course.
> 
> **How to Test Manually:**
> - Create a course with a capacity of 5.
> - Enroll 2 students and verify the progress bar on the course card reflects 40%.
> - Unenroll a student and verify the `enrolled_count` decreases."

---

## 📊 Sprint 4: The "Logic" Prompt
**Goal:** Marks entry and Attendance tracking.

> **Prompt:**
> "Build the Marks and Attendance systems (F-05 and F-06).
> 1. **Backend:** Implement `/marks` and `/attendance/bulk`. In the marks service, auto-calculate the Grade (A-F) based on the scale in `FDD.md`.
> 2. **Frontend - Marks:** Create `MarksPage.jsx`. When entering marks, show a 'Live Preview' of the grade and GPA before saving.
> 3. **Frontend - Attendance:** Create `AttendancePage.jsx`. Implement a bulk-mark feature where all students default to 'Present'.
> 4. Add a red warning badge for students with < 75% attendance on their profile.
> 
> **How to Test Manually:**
> - Go to Marks, enter '85/100'. Verify the preview shows 'Grade: A'.
> - Mark a student 'Absent' multiple times. Go to their profile and check if the attendance percentage drops and turns red below 75%."

---

## 🚀 Sprint 5: The "Polishing" Prompt
**Goal:** Dashboard charts and final deployment.

> **Prompt:**
> "Finalize the Dashboard and prepare for deployment (F-07 and `deployment.md`).
> 1. **Dashboard:** Use `recharts` to build a Bar Chart for Grade Distribution and a Line Chart for Enrollment Trends.
> 2. Implement the 4 Stat Cards (Total Students, Courses, Avg GPA, Avg Attendance).
> 3. **Polish:** Ensure every API call has a loading spinner and every success/error shows a `sonner` toast notification.
> 4. **Mobile:** Ensure the sidebar collapses into a hamburger menu on screens < 768px.
> 
> **How to Test Manually:**
> - Compare Dashboard numbers with your MongoDB collection counts to ensure accuracy.
> - Open the app on a phone (or Chrome mobile emulator) and test the navigation menu.
> - Trigger an error (e.g., turn off backend) and verify a 'Toast' notification appears."

---

### 💡 Pro-Tips for the Vibe Coder:
* **Context is King:** Always keep the `docs/` files open in your IDE's sidebar so the AI can "see" them.
* **Seed Early:** Run the `python scripts/seed_data.py` after Sprint 1 so you aren't working with an empty UI.
* **Incremental Saves:** After each prompt, if the code works, **commit to Git**. If the AI breaks something in the next step, you can revert easily.

Which sprint are you diving into first, Karthik?
