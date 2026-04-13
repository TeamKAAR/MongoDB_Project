import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getHomePath, roleAllows } from '../lib/rbac.js'
import { useAuthStore } from '../store/authStore.js'

function ProtectedRoute({ allowedRoles = [] }) {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!roleAllows(user, allowedRoles)) {
    return <Navigate to={getHomePath(user)} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
