# 🚀 Deployment Guide
## EduTrack — Zero-Cost Full Deployment

---

## Stack Overview

| Layer | Platform | Cost |
|-------|----------|------|
| Frontend | Vercel | Free |
| Backend | Render.com | Free |
| Database | MongoDB Atlas | Free (M0 512MB) |

---

## Step 1: MongoDB Atlas Setup

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Create free account → **Create Free Cluster (M0)**
3. Choose region closest to your users
4. **Database Access** → Add user: `edutrack_user` / strong password
5. **Network Access** → Allow from anywhere: `0.0.0.0/0`
6. **Connect** → Get connection string:
   ```
   mongodb+srv://edutrack_user:<password>@cluster0.xxxxx.mongodb.net/edutrack
   ```
7. Save this — it's your `MONGODB_URI`

---

## Step 2: Seed the Database

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your MONGODB_URI

python scripts/seed_data.py
# ✅ Should insert 10+ students, courses, marks, attendance
```

---

## Step 3: Deploy Backend to Render.com

1. Push code to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect GitHub repo → select `backend/` as root
4. Settings:
   ```
   Runtime: Python 3.11
   Build Command: pip install -r requirements.txt
   Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
5. **Environment Variables** (Add these):
   ```
   MONGODB_URI = mongodb+srv://...
   JWT_SECRET  = your-random-secret-string-here
   CORS_ORIGINS = ["https://your-app.vercel.app"]
   ```
6. Deploy → Get URL: `https://edutrack-api.onrender.com`

> ⚠️ Free Render instances sleep after 15min inactivity. Upgrade to $7/mo to keep awake.

---

## Step 4: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import GitHub repo → select `frontend/` as root
3. Framework: **Vite**
4. **Environment Variables**:
   ```
   VITE_API_URL = https://edutrack-api.onrender.com
   ```
5. Deploy → Get URL: `https://edutrack.vercel.app`

---

## Step 5: Update CORS on Backend

Go to Render → Environment Variables → Update:
```
CORS_ORIGINS = ["https://edutrack.vercel.app"]
```
Redeploy.

---

## Local Development

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # fill in MONGODB_URI
uvicorn main:app --reload --port 8000
# API docs: http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:8000
npm run dev
# App: http://localhost:5173
```

---

## Verify Deployment

```bash
# Test API health
curl https://edutrack-api.onrender.com/health

# Test auth
curl -X POST https://edutrack-api.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@edutrack.com","password":"Admin@123"}'
```

---

## Default Login Credentials (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@edutrack.com | Admin@123 |
| Teacher | teacher@edutrack.com | Teacher@123 |
| Student | student@edutrack.com | Student@123 |

> **Change these immediately in production!**
