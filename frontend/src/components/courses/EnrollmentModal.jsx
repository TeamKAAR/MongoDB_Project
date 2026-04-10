import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/button.jsx'
import { Input } from '../ui/input.jsx'
import { apiRequest } from '../../lib/api.js'

function EnrollmentModal({ course, isOpen, onClose, onEnrollmentChanged }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [students, setStudents] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !course) {
      return
    }

    let active = true

    const loadData = async () => {
      setIsLoading(true)

      try {
        const [studentsPayload, enrollmentsPayload] = await Promise.all([
          apiRequest('/api/v1/students?limit=100&status=active'),
          apiRequest(`/api/v1/enrollments/course/${course.id}`),
        ])

        if (active) {
          setStudents(studentsPayload.items)
          setEnrollments(enrollmentsPayload)
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

    loadData()

    return () => {
      active = false
    }
  }, [course, isOpen])

  const filteredStudents = useMemo(() => {
    const enrolledIds = new Set(enrollments.map((enrollment) => enrollment.student_id))
    const query = searchTerm.trim().toLowerCase()

    return students.filter((student) => {
      if (enrolledIds.has(student.id)) {
        return false
      }

      if (!query) {
        return true
      }

      const haystack = `${student.name.first} ${student.name.last} ${student.student_id} ${student.email}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [enrollments, searchTerm, students])

  if (!isOpen || !course) {
    return null
  }

  const refreshEnrollments = async () => {
    const payload = await apiRequest(`/api/v1/enrollments/course/${course.id}`)
    setEnrollments(payload)
    onEnrollmentChanged()
  }

  const handleEnroll = async (studentId) => {
    setIsSubmitting(true)

    try {
      await apiRequest('/api/v1/enrollments', {
        method: 'POST',
        body: JSON.stringify({ student_id: studentId, course_id: course.id }),
        successMessage: 'Student enrolled successfully.',
        showSuccessToast: true,
      })
      await refreshEnrollments()
      setError('')
      setSearchTerm('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUnenroll = async (studentId) => {
    setIsSubmitting(true)

    try {
      await apiRequest(`/api/v1/enrollments/${studentId}/${course.id}`, {
        method: 'DELETE',
        successMessage: 'Enrollment removed.',
        showSuccessToast: true,
      })
      await refreshEnrollments()
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Manage enrollments for ${course.name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="section-label">Enrollment</p>
            <h2>{course.name}</h2>
            <p className="lead">Search active students and assign them to this course.</p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        {error ? <p className="error-box">{error}</p> : null}

        <div className="enrollment-layout">
          <section className="enrollment-column">
            <div className="enrollment-column-header">
              <h3>Enroll student</h3>
              <p>Search by name, email, or student ID.</p>
            </div>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search students"
            />
            <div className="enrollment-list">
              {isLoading ? (
                <p className="empty-state">Loading students...</p>
              ) : filteredStudents.length === 0 ? (
                <p className="empty-state">No matching students available.</p>
              ) : (
                filteredStudents.map((student) => (
                  <article key={student.id} className="enrollment-item">
                    <div>
                      <strong>
                        {student.name.first} {student.name.last}
                      </strong>
                      <p>{student.student_id}</p>
                    </div>
                    <Button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleEnroll(student.id)}
                    >
                      Enroll
                    </Button>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="enrollment-column">
            <div className="enrollment-column-header">
              <h3>Enrolled students</h3>
              <p>{enrollments.length} active enrollment(s)</p>
            </div>
            <div className="enrollment-list">
              {isLoading ? (
                <p className="empty-state">Loading enrollments...</p>
              ) : enrollments.length === 0 ? (
                <p className="empty-state">No students enrolled yet.</p>
              ) : (
                enrollments.map((enrollment) => (
                  <article key={enrollment.id} className="enrollment-item">
                    <div>
                      <strong>{enrollment.student_name}</strong>
                      <p>{enrollment.student_code}</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isSubmitting}
                      onClick={() => handleUnenroll(enrollment.student_id)}
                    >
                      Unenroll
                    </Button>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

export default EnrollmentModal
