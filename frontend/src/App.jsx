import { Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import StudentProfilePage from './pages/StudentProfilePage.jsx'
import StudentsPage from './pages/StudentsPage.jsx'
import { useAuthStore } from './store/authStore.js'

function App() {
  const token = useAuthStore((state) => state.token)

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={token ? '/dashboard' : '/login'} replace />}
      />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/students/:studentId" element={<StudentProfilePage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={token ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  )
}

export default App
