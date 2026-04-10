import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { apiRequest } from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'

function statValue(stat) {
  if (stat.label === 'Total Students' || stat.label === 'Courses') {
    return Math.round(stat.value)
  }

  return `${stat.value.toFixed(2)}${stat.suffix ? ` ${stat.suffix}` : ''}`
}

function DashboardPage() {
  const user = useAuthStore((state) => state.user)
  const [health, setHealth] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      setIsLoading(true)

      try {
        const [healthPayload, analyticsPayload] = await Promise.all([
          apiRequest('/health'),
          apiRequest('/api/v1/dashboard/analytics'),
        ])

        if (active) {
          setHealth(healthPayload)
          setAnalytics(analyticsPayload)
          setError('')
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [])

  const stats = useMemo(() => analytics?.stats ?? [], [analytics])

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Sprint 5 - Analytics</p>
          <h1>Institution command center.</h1>
          <p className="lead">
            Welcome back, {user?.name ?? 'EduTrack user'}. This dashboard now pulls
            live metrics, grade insights, enrollment movement, and deployment-ready
            status from the API.
          </p>
        </div>
      </section>

      {error ? <p className="error-box">{error}</p> : null}

      {isLoading ? (
        <div className="empty-state">
          <p>Loading dashboard analytics...</p>
        </div>
      ) : (
        <>
          <section className="dashboard-stat-grid">
            {stats.map((stat) => (
              <Card key={stat.label} className="stat-card">
                <CardHeader>
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle>{statValue(stat)}</CardTitle>
                </CardHeader>
              </Card>
            ))}
          </section>

          <section className="dashboard-chart-grid">
            <Card>
              <CardHeader>
                <CardTitle>Grade Distribution</CardTitle>
                <CardDescription>Live grade mix across recorded assessments.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="chart-shell">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.grade_distribution ?? []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="grade" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#155e75" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Enrollment Trends</CardTitle>
                <CardDescription>Monthly enrollments over the last six months.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="chart-shell">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.enrollment_trends ?? []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="enrollments"
                        stroke="#0f766e"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="dashboard-bottom-grid">
            <Card>
              <CardHeader>
                <CardTitle>Top Students by GPA</CardTitle>
                <CardDescription>Highest current average GPA from recorded marks.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.top_students?.length ? (
                  <div className="dashboard-list">
                    {analytics.top_students.map((student) => (
                      <div key={student.student_id} className="dashboard-list-item">
                        <div>
                          <strong>{student.student_name}</strong>
                          <p>{student.student_id}</p>
                        </div>
                        <span className="profile-pill">{student.gpa.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No GPA data available yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Alerts</CardTitle>
                <CardDescription>Courses with the weakest attendance rates right now.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.attendance_alerts?.length ? (
                  <div className="dashboard-list">
                    {analytics.attendance_alerts.map((course) => (
                      <div key={course.course_id} className="dashboard-list-item">
                        <div>
                          <strong>{course.course_name}</strong>
                          <p>Attendance watchlist</p>
                        </div>
                        <span
                          className={`status-badge ${course.attendance_rate < 75 ? 'status-inactive' : 'status-active'}`}
                        >
                          {course.attendance_rate.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No attendance alerts available yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Deployment Readiness</CardTitle>
              <CardDescription>Aligned with the zero-cost stack in `deployment.md`.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="status-grid">
                <div>
                  <dt>Frontend</dt>
                  <dd>Vercel + `VITE_API_URL`</dd>
                </div>
                <div>
                  <dt>Backend</dt>
                  <dd>Render + `uvicorn main:app`</dd>
                </div>
                <div>
                  <dt>Database</dt>
                  <dd>{health?.database ?? 'edutrack'} on MongoDB Atlas</dd>
                </div>
                <div>
                  <dt>CORS</dt>
                  <dd>Uses `CORS_ORIGINS` env configuration</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}

export default DashboardPage
