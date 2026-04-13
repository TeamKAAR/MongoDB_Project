import { useEffect, useState } from 'react'
import EnrollmentModal from '../components/courses/EnrollmentModal.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { apiRequest } from '../lib/api.js'
import { useAuthStore } from '../store/authStore.js'

function capacityPercent(enrolled, capacity) {
  if (!capacity) {
    return 0
  }

  return Math.min(100, Math.round((enrolled / capacity) * 100))
}

function CoursesPage() {
  const user = useAuthStore((state) => state.user)
  const canManageEnrollments = user?.role === 'admin'
  const [courses, setCourses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCourse, setSelectedCourse] = useState(null)

  const loadCourses = async () => {
    setIsLoading(true)

    try {
      const payload = await apiRequest('/api/v1/courses')
      setCourses(payload)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCourses()
  }, [])

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Courses module</p>
        <h1>Courses</h1>
        <p className="lead">
          Browse courses, watch capacity in real time, and manage enrollment from
          the card grid.
        </p>
      </section>

      {error ? <p className="error-box">{error}</p> : null}

      {isLoading ? (
        <div className="empty-state">
          <p>Loading courses...</p>
        </div>
      ) : (
        <section className="courses-grid">
          {courses.map((course) => {
            const percent = capacityPercent(course.enrolled_count, course.capacity)

            return (
              <Card key={course.id} className="course-card">
                <CardHeader>
                  <div className="course-card-top">
                    <span className="profile-pill">{course.course_code}</span>
                    <span className={`status-badge status-${course.status === 'active' ? 'active' : 'inactive'}`}>
                      {course.status}
                    </span>
                  </div>
                  <CardTitle>{course.name}</CardTitle>
                  <CardDescription>{course.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="course-meta">
                    <p>
                      <strong>Teacher:</strong> {course.teacher_name ?? 'Unassigned'}
                    </p>
                    <p>
                      <strong>Credits:</strong> {course.credits}
                    </p>
                    <p>
                      <strong>Schedule:</strong> {course.schedule.days.join(', ')} at {course.schedule.time}
                    </p>
                    <p>
                      <strong>Room:</strong> {course.schedule.room}
                    </p>
                  </div>

                  <div className="capacity-block">
                    <div className="capacity-label">
                      <span>
                        Enrolled: {course.enrolled_count} / {course.capacity}
                      </span>
                      <span>{percent}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>

                  <div className="course-actions">
                    {canManageEnrollments ? (
                      <Button type="button" onClick={() => setSelectedCourse(course)}>
                        Enroll
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      <EnrollmentModal
        course={selectedCourse}
        isOpen={canManageEnrollments && Boolean(selectedCourse)}
        onClose={() => setSelectedCourse(null)}
        onEnrollmentChanged={loadCourses}
      />
    </main>
  )
}

export default CoursesPage
