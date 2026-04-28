import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import AppLayout from './components/AppLayout.jsx'
import GlobalRequestOverlay from './components/GlobalRequestOverlay.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AttendancePage from './pages/AttendancePage.jsx'
import CoursesPage from './pages/CoursesPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import MarksPage from './pages/MarksPage.jsx'
import MyMenteesPage from './pages/MyMenteesPage.jsx'
import StudentProfilePage from './pages/StudentProfilePage.jsx'
import StudentsPage from './pages/StudentsPage.jsx'
import { getHomePath } from './lib/rbac.js'
import { useAuthStore } from './store/authStore.js'

function App() {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const homePath = getHomePath(user)

  return (
    <>
      <GlobalRequestOverlay />
      <Routes>
        <Route
          path="/"
          element={<Navigate to={token ? homePath : '/login'} replace />}
        />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route element={<ProtectedRoute allowedRoles={['admin', 'teacher']} />}>
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/marks" element={<MarksPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/courses" element={<CoursesPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/mentees" element={<MyMenteesPage />} />
            </Route>
            <Route
              element={<ProtectedRoute allowedRoles={['admin', 'teacher', 'student']} />}
            >
              <Route path="/students/:studentId" element={<StudentProfilePage />} />
            </Route>
          </Route>
        </Route>
        <Route
          path="*"
          element={<Navigate to={token ? homePath : '/login'} replace />}
        />
      </Routes>
    </>
  )
}

export default App
