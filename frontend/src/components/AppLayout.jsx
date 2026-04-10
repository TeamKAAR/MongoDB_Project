import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from './ui/button.jsx'
import { useAuthStore } from '../store/authStore.js'
import { useUiStore } from '../store/uiStore.js'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/students', label: 'Students' },
  { to: '/courses', label: 'Courses' },
  { to: '/marks', label: 'Marks' },
  { to: '/attendance', label: 'Attendance' },
]

function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen)
  const toggleMobileNav = useUiStore((state) => state.toggleMobileNav)
  const closeMobileNav = useUiStore((state) => state.closeMobileNav)

  useEffect(() => {
    closeMobileNav()
  }, [closeMobileNav, location.pathname])

  const handleLogout = () => {
    logout()
    closeMobileNav()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-frame">
      <aside className={`app-sidebar ${mobileNavOpen ? 'app-sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Link className="sidebar-logo" to="/dashboard">
            EduTrack
          </Link>
          <p>Operations cockpit for students, courses, grades, and attendance.</p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div>
            <p className="section-label">Signed in as</p>
            <strong>{user?.name ?? 'EduTrack user'}</strong>
            <p>{user?.role ?? 'member'}</p>
          </div>
          <Button type="button" variant="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </aside>

      <div
        className={`app-sidebar-overlay ${mobileNavOpen ? 'app-sidebar-overlay-visible' : ''}`}
        role="presentation"
        onClick={closeMobileNav}
      />

      <div className="app-content">
        <header className="mobile-topbar">
          <button
            type="button"
            className="hamburger-button"
            aria-label="Open navigation menu"
            onClick={toggleMobileNav}
          >
            <span />
            <span />
            <span />
          </button>
          <div>
            <p className="section-label">EduTrack</p>
            <strong>Campus dashboard</strong>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  )
}

export default AppLayout
