# 📐 Software Design Document (SDD)
## EduTrack — Student Management SaaS Platform
**Version:** 1.0.0 | **Date:** 2025 | **Status:** Ready for Development

---

## 1. Overview

EduTrack is a multi-tenant SaaS platform for managing students, courses, attendance, and grades. Built with React (Vite + shadcn/ui), Python (FastAPI), and MongoDB Atlas.

---

## 2. System Architecture Summary

```
[React SPA] ──► [FastAPI Backend] ──► [MongoDB Atlas]
                      │
                 [JWT Auth]
                 [Pydantic Validation]
                 [Motor Async Driver]
```

---

## 3. Module Breakdown

### 3.1 Authentication Module
- JWT-based login/register
- Role: `admin`, `teacher`, `student`
- Middleware guards all protected routes

### 3.2 Student Module
- CRUD: create, read, update, soft-delete students
- Fields: name, email, phone, DOB, address, enrollment date, status
- Pagination + search + filter by course/status

### 3.3 Course Module
- Create & manage courses (name, code, credits, teacher, schedule)
- Enroll/unenroll students
- Course capacity limits

### 3.4 Marks Module
- Record marks per student per course per assessment type
- Auto-calculate grade (A–F) and GPA
- Assessment types: `quiz`, `midterm`, `final`, `assignment`

### 3.5 Attendance Module
- Mark daily attendance per course
- Bulk mark (present/absent/late)
- Calculate attendance percentage
- Alert on < 75% attendance

### 3.6 Dashboard / Analytics Module
- Top-level stats (total students, courses, avg GPA)
- Charts: attendance trends, grade distribution, enrollment growth
- Per-student academic profile

---

## 4. Data Flow

```
User Action (UI)
     │
     ▼
React Component → API Service (axios) → FastAPI Route
                                              │
                                         Pydantic Model (validation)
                                              │
                                         MongoDB (Motor async)
                                              │
                                         Response Model → JSON → UI State
```

---

## 5. API Design Principles

- **REST** with versioning: `/api/v1/`
- All responses: `{ success, data, message, pagination? }`
- HTTP status codes strictly followed
- Error format: `{ success: false, error: { code, message, details } }`

---

## 6. Security Design

| Layer | Mechanism |
|-------|-----------|
| Auth | JWT (HS256, 24h expiry) |
| Password | bcrypt hashing |
| Transport | HTTPS only |
| Input | Pydantic validation + sanitization |
| CORS | Whitelist-only origins |
| Rate Limiting | slowapi (100 req/min) |

---

## 7. Non-Functional Requirements

| NFR | Target |
|-----|--------|
| Response Time | < 300ms (p95) |
| Uptime | 99.5% |
| Concurrent Users | 500+ |
| Data Retention | 5 years |
| Mobile Responsive | Yes (320px+) |

---

## 8. Error Handling Strategy

- All exceptions caught by global FastAPI exception handler
- Pydantic `ValidationError` → 422 with field-level details
- MongoDB errors → 500 with safe message (no internals leaked)
- Frontend: toast notifications + error boundaries

---

## 9. Technology Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Frontend | React + Vite | Fast HMR, modern ecosystem |
| UI Library | shadcn/ui + Tailwind | Unstyled components, full control |
| Backend | FastAPI | Async, typed, auto-docs |
| DB Driver | Motor | Async MongoDB for FastAPI |
| Auth | python-jose | JWT standard |
| Deployment | Render (backend) + Vercel (frontend) + MongoDB Atlas | Free tier, zero-config |