import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { useAuthStore } from '../store/authStore.js'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const fetchMe = useAuthStore((state) => state.fetchMe)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMe().catch(() => {})
  }, [fetchMe])

  useEffect(() => {
    let active = true

    const loadHealth = async () => {
      try {
        const response = await fetch(`${API_URL}/health`)
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.detail ?? 'Health check failed.')
        }

        if (active) {
          setHealth(payload)
          setError('')
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message)
        }
      }
    }

    loadHealth()

    return () => {
      active = false
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <main className="app-shell">
      <section className="hero-panel dashboard-header">
        <div>
          <p className="eyebrow">Protected dashboard</p>
          <h1>Welcome, {user?.name ?? 'EduTrack user'}.</h1>
          <p className="lead">
            Your JWT session is active and this route is only visible to signed-in
            users.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={handleLogout}>
          Logout
        </Button>
      </section>

      <div className="status-stack">
        <Card>
          <CardHeader>
            <CardTitle>Next module</CardTitle>
            <CardDescription>Jump straight into the student registry.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="ui-button ui-button-primary dashboard-link" to="/students">
              Open students
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Loaded from Zustand + localStorage.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="status-grid">
              <div>
                <dt>Name</dt>
                <dd>{user?.name ?? '-'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{user?.email ?? '-'}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{user?.role ?? '-'}</dd>
              </div>
              <div>
                <dt>Access</dt>
                <dd>Authenticated</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backend handshake</CardTitle>
            <CardDescription>Reuses the Sprint 0 health endpoint.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? <p className="error-box">{error}</p> : null}
            {!health && !error ? <p className="message">Contacting backend...</p> : null}
            {health ? (
              <dl className="status-grid">
                <div>
                  <dt>Status</dt>
                  <dd>{health.status}</dd>
                </div>
                <div>
                  <dt>Service</dt>
                  <dd>{health.service}</dd>
                </div>
                <div>
                  <dt>Database</dt>
                  <dd>{health.database}</dd>
                </div>
                <div>
                  <dt>Collections</dt>
                  <dd>{health.collections.join(', ')}</dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default DashboardPage
