import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { apiRequest } from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'
import { avatarColor, formatDate, initials } from '../lib/utils.js'

function MyMenteesPage() {
  const user = useAuthStore((state) => state.user)
  const [mentees, setMentees] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user || user.role !== 'teacher') return

    let active = true
    const loadMentees = async () => {
      setIsLoading(true)
      try {
        const result = await apiRequest(`/api/v1/mentorships/teacher/${user.id}`)
        if (active) {
          setMentees(result.items ?? [])
          setError('')
        }
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    loadMentees()
    return () => { active = false }
  }, [user])

  if (!user || user.role !== 'teacher') {
    return (
      <main className="app-shell">
        <Card>
          <CardContent>
            <p className="error-box">Only teachers can view this page.</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Sprint 6 — Mentorship</p>
          <h1>My Mentees</h1>
          <p className="lead">
            Students currently assigned to you as their mentor. Track their progress and log interactions.
          </p>
        </div>
      </section>

      {error ? <p className="error-box">{error}</p> : null}

      {isLoading ? (
        <div className="empty-state">
          <p>Loading mentees...</p>
        </div>
      ) : mentees.length === 0 ? (
        <div className="empty-state">
          <p>No mentees assigned yet. An admin can assign students to you.</p>
        </div>
      ) : (
        <section className="mentee-card-grid">
          {mentees.map((m) => {
            const studentName = m.student_name ?? 'Unnamed Student'
            const nameObj = { first: studentName.split(' ')[0] || '', last: studentName.split(' ').slice(1).join(' ') || '' }
            return (
              <Card key={m.id} className="mentee-card">
                <CardContent>
                  <div className="mentee-card-identity">
                    <div
                      className="avatar-circle"
                      style={{ backgroundColor: avatarColor(m.student_code ?? m.student_id) }}
                    >
                      {initials(nameObj)}
                    </div>
                    <div>
                      <h3 className="mentee-card-name">{studentName}</h3>
                      <p className="mentee-card-meta">{m.student_code ?? '—'}</p>
                      {m.student_email ? (
                        <p className="mentee-card-meta">{m.student_email}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mentee-card-footer">
                    <div className="badge-row">
                      <span className={`status-badge status-${m.status}`}>{m.status}</span>
                      <span className="mentee-card-meta">Since {formatDate(m.assigned_date)}</span>
                    </div>
                    <Link className="text-button" to={`/students/${m.student_id}`}>
                      View profile →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}
    </main>
  )
}

export default MyMenteesPage
