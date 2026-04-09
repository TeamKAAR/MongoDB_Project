import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import { useAuthStore } from '../store/authStore.js'

const DEMO_USERS = [
  { label: 'Admin', email: 'admin@edutrack.com', password: 'Admin@123', role: 'admin' },
  { label: 'Teacher', email: 'teacher@edutrack.com', password: 'Teacher@123', role: 'teacher' },
  { label: 'Student', email: 'student@edutrack.com', password: 'Student@123', role: 'student' },
]

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)
  const error = useAuthStore((state) => state.error)
  const isLoading = useAuthStore((state) => state.isLoading)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const redirectTo = location.state?.from?.pathname ?? '/dashboard'

  const handleDemoFill = (demoUser) => {
    setEmail(demoUser.email)
    setPassword(demoUser.password)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch {
      return
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-copy">
        <p className="eyebrow">Sprint 1 - Gatekeeper</p>
        <h1>Sign in to EduTrack.</h1>
        <p className="lead">
          JWT auth is now guarding the app. Pick a demo role or use your own
          account to enter the dashboard.
        </p>
        <div className="demo-grid">
          {DEMO_USERS.map((demoUser) => (
            <button
              key={demoUser.role}
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill(demoUser)}
            >
              <span>{demoUser.label}</span>
              <small>{demoUser.email}</small>
            </button>
          ))}
        </div>
      </section>

      <Card className="auth-card">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Use the demo accounts or sign in with an EduTrack user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@edutrack.com"
                required
              />
            </div>

            <div className="field-group">
              <div className="field-label-row">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide password' : 'Show password'}
                </button>
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {error ? <p className="error-box">{error}</p> : null}

            <Button type="submit" disabled={isLoading} className="full-width">
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default LoginPage
