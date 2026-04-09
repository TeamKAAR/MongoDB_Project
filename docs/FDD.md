# 🚀 Feature Design Document (FDD)
## EduTrack — Student Management SaaS Platform
**Version:** 1.0.0 | **Sprint-Ready Format**

---

## Feature Index

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| F-01 | Authentication & Roles | P0 | 🔴 Todo |
| F-02 | Student CRUD | P0 | 🔴 Todo |
| F-03 | Course Management | P0 | 🔴 Todo |
| F-04 | Enrollment | P0 | 🔴 Todo |
| F-05 | Marks & Grades | P0 | 🔴 Todo |
| F-06 | Attendance Tracking | P0 | 🔴 Todo |
| F-07 | Dashboard Analytics | P1 | 🔴 Todo |
| F-08 | Student Profile Page | P1 | 🔴 Todo |
| F-09 | Search & Filter | P1 | 🔴 Todo |
| F-10 | Export (CSV/PDF) | P2 | 🔴 Todo |

---

## F-01: Authentication & Roles

**User Story:** As an admin, I want to log in securely and manage who can access the system.

**Acceptance Criteria:**
- [ ] Register with name, email, password, role
- [ ] Login returns JWT token (24h expiry)
- [ ] Protected routes return 401 if no/invalid token
- [ ] Role-based access: admin sees all, teacher sees own courses, student sees own data
- [ ] Refresh token flow (optional for v1)

**API Endpoints:**
```
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

**UI Components:**
- `LoginPage` — email + password form, show/hide password
- `RegisterPage` — name, email, password, role selector
- `AuthGuard` — HOC wrapping protected routes

---

## F-02: Student CRUD

**User Story:** As an admin, I want to add, view, edit, and remove student records.

**Acceptance Criteria:**
- [ ] Create student with all required fields
- [ ] List students with pagination (20/page default)
- [ ] Search by name or student ID
- [ ] Filter by status (active/inactive/graduated)
- [ ] Edit student details inline or via modal
- [ ] Soft delete (status = "inactive"), not hard delete

**API Endpoints:**
```
POST   /api/v1/students
GET    /api/v1/students?page=1&limit=20&search=&status=
GET    /api/v1/students/:id
PUT    /api/v1/students/:id
DELETE /api/v1/students/:id
```

**UI Components:**
- `StudentsListPage` — table with search bar, filters, pagination
- `StudentFormModal` — create/edit drawer
- `StudentBadge` — status chip (active/inactive/graduated)

**Validations:**
- Email: unique, valid format
- Phone: 10-digit
- DOB: must be ≥ 15 years ago
- Student ID: auto-generated (STU-YYYY-NNNN)

---

## F-03: Course Management

**User Story:** As an admin/teacher, I want to create and manage courses.

**Acceptance Criteria:**
- [ ] Create course with code, name, credits, teacher, schedule, capacity
- [ ] List all courses with enrollment count
- [ ] Edit/archive courses
- [ ] Assign a teacher to a course

**API Endpoints:**
```
POST   /api/v1/courses
GET    /api/v1/courses
GET    /api/v1/courses/:id
PUT    /api/v1/courses/:id
DELETE /api/v1/courses/:id
```

**UI Components:**
- `CoursesPage` — card grid or table view
- `CourseFormModal`
- `CourseCard` — shows name, code, enrolled/capacity, teacher

---

## F-04: Enrollment

**User Story:** As an admin, I want to enroll students in courses.

**Acceptance Criteria:**
- [ ] Enroll student in one or multiple courses
- [ ] Prevent duplicate enrollment
- [ ] Unenroll with reason
- [ ] Show enrolled courses on student profile

**API Endpoints:**
```
POST   /api/v1/enrollments
DELETE /api/v1/enrollments/:studentId/:courseId
GET    /api/v1/enrollments/student/:studentId
GET    /api/v1/enrollments/course/:courseId
```

---

## F-05: Marks & Grades

**User Story:** As a teacher, I want to record and view marks for each student per assessment.

**Acceptance Criteria:**
- [ ] Add marks per student, per course, per assessment type
- [ ] Auto-calculate letter grade (A/B/C/D/F) and GPA points
- [ ] View marks table per course
- [ ] Overall GPA per student (weighted by credits)

**Grade Scale:**
| Marks | Grade | Points |
|-------|-------|--------|
| 90–100 | A+ | 4.0 |
| 80–89 | A | 3.7 |
| 70–79 | B | 3.0 |
| 60–69 | C | 2.0 |
| 50–59 | D | 1.0 |
| < 50 | F | 0.0 |

**API Endpoints:**
```
POST   /api/v1/marks
GET    /api/v1/marks/student/:studentId
GET    /api/v1/marks/course/:courseId
PUT    /api/v1/marks/:id
```

---

## F-06: Attendance Tracking

**User Story:** As a teacher, I want to mark and review attendance for my classes.

**Acceptance Criteria:**
- [ ] Mark attendance for a course on a given date
- [ ] Status options: present, absent, late, excused
- [ ] Bulk mark all students at once
- [ ] View attendance summary per student (% present)
- [ ] Alert when student < 75% attendance

**API Endpoints:**
```
POST   /api/v1/attendance
GET    /api/v1/attendance/course/:courseId?date=
GET    /api/v1/attendance/student/:studentId
GET    /api/v1/attendance/student/:studentId/summary
```

---

## F-07: Dashboard Analytics

**User Story:** As an admin, I want a bird's-eye view of the institution's performance.

**Metrics to display:**
- Total students (+ % change this month)
- Total courses (active)
- Average GPA across all students
- Average attendance rate
- Grade distribution bar chart
- Attendance trend (last 30 days) line chart
- Top 5 students by GPA
- Courses with lowest attendance (alert)

**UI Components:**
- `StatCard` — metric + trend indicator
- `GradeDistributionChart` (recharts BarChart)
- `AttendanceTrendChart` (recharts LineChart)
- `TopStudentsTable`

---

## F-08: Student Profile Page

**Full academic profile view:**
- Personal info card
- Enrolled courses list with marks
- Attendance summary per course
- Overall GPA + credit hours
- Academic history timeline

---

## F-09: Search & Filter

**Global search:** students by name/ID/email  
**Course filter:** by teacher, credits, status  
**Marks filter:** by grade range, assessment type  
**Attendance filter:** by date range, course, status  

---

## F-10: Export

- Export students list as CSV
- Export marks report as PDF (per student or per course)
- Libraries: `Papa Parse` (CSV), `jsPDF` (PDF)