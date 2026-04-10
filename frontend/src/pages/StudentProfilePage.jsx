import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StudentFormModal from '../components/students/StudentFormModal.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx'
import { apiRequest } from '../lib/api.js'
import { avatarColor, formatDate, initials } from '../lib/utils.js'

const TABS = [
  { id: 'courses', label: 'Courses' },
  { id: 'marks', label: 'Marks' },
  { id: 'attendance', label: 'Attendance' },
]

function StudentProfilePage() {
  const { studentId } = useParams()
  const [student, setStudent] = useState(null)
  const [courses, setCourses] = useState([])
  const [marks, setMarks] = useState([])
  const [marksSummary, setMarksSummary] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [activeTab, setActiveTab] = useState('courses')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const hasLowAttendance = attendance.some((entry) => entry.percentage < 75)

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      setIsLoading(true)

      try {
        const [studentPayload, coursesPayload, marksPayload, attendancePayload] =
          await Promise.all([
            apiRequest(`/api/v1/students/${studentId}`),
            apiRequest(`/api/v1/enrollments/student/${studentId}`),
            apiRequest(`/api/v1/marks/student/${studentId}`),
            apiRequest(`/api/v1/attendance/student/${studentId}/summary`),
          ])

        if (active) {
          setStudent(studentPayload)
          setCourses(coursesPayload)
          setMarks(marksPayload.items)
          setMarksSummary(marksPayload.summary)
          setAttendance(attendancePayload)
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

    loadProfile()

    return () => {
      active = false
    }
  }, [studentId])

  const handleSaved = (savedStudent, message) => {
    setStudent(savedStudent)
    setNotice(message)
  }

  if (isLoading) {
    return (
      <main className="app-shell">
        <div className="empty-state">
          <p>Loading student profile...</p>
        </div>
      </main>
    )
  }

  if (error || !student) {
    return (
      <main className="app-shell">
        <Card>
          <CardContent>
            <p className="error-box">{error || 'Student not found.'}</p>
            <Link className="text-button" to="/students">
              Back to students
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <div className="page-back-link">
        <Link className="text-button" to="/students">
          Back to students
        </Link>
      </div>

      <Card>
        <CardContent>
          {notice ? <p className="success-box">{notice}</p> : null}
          <div className="profile-header">
            <div className="profile-identity">
              <div
                className="avatar-circle avatar-large"
                style={{ backgroundColor: avatarColor(student.student_id) }}
              >
                {initials(student.name)}
              </div>
              <div>
                <div className="badge-row">
                  <span className="profile-pill">{student.student_id}</span>
                  <span className={`status-badge status-${student.status}`}>
                    {student.status}
                  </span>
                  {hasLowAttendance ? (
                    <span className="status-badge status-inactive">Attendance alert</span>
                  ) : null}
                </div>
                <h1>
                  {student.name.first} {student.name.last}
                </h1>
                <p className="lead">Student academic profile and supporting records.</p>
              </div>
            </div>

            <Button type="button" onClick={() => setIsModalOpen(true)}>
              Edit student
            </Button>
          </div>

          <div className="profile-grid">
            <div>
              <p className="section-label">Email</p>
              <p>{student.email}</p>
            </div>
            <div>
              <p className="section-label">Phone</p>
              <p>{student.phone}</p>
            </div>
            <div>
              <p className="section-label">Gender</p>
              <p>{student.gender}</p>
            </div>
            <div>
              <p className="section-label">Date of birth</p>
              <p>{formatDate(student.date_of_birth)}</p>
            </div>
            <div>
              <p className="section-label">Enrollment date</p>
              <p>{formatDate(student.enrollment_date)}</p>
            </div>
            <div>
              <p className="section-label">Address</p>
              <p>
                {student.address.street}, {student.address.city}, {student.address.state}{' '}
                {student.address.pincode}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Academic tabs</CardTitle>
          <CardDescription>
            The profile is ready for the course, marks, and attendance modules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="tabs-row">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'courses' ? (
            courses.length === 0 ? (
              <div className="empty-state">
                <p>No enrolled courses yet.</p>
              </div>
            ) : (
              <div className="table-shell">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course code</TableHead>
                      <TableHead>Course name</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Enrolled date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((course) => (
                      <TableRow key={`${course.course_id}-${course.enrolled_at}`}>
                        <TableCell>{course.course_code ?? '-'}</TableCell>
                        <TableCell>{course.course_name ?? 'Pending course module'}</TableCell>
                        <TableCell>{course.credits ?? '-'}</TableCell>
                        <TableCell>{formatDate(course.enrolled_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : null}

          {activeTab === 'marks' ? (
            <>
              {marksSummary?.overall_gpa !== null ? (
                <div className="summary-strip">
                  <div className="summary-card">
                    <p className="section-label">Overall GPA</p>
                    <p>{marksSummary.overall_gpa}</p>
                  </div>
                  <div className="summary-card">
                    <p className="section-label">Average percentage</p>
                    <p>{marksSummary.average_percentage}%</p>
                  </div>
                </div>
              ) : null}

              {marks.length === 0 ? (
                <div className="empty-state">
                  <p>No marks recorded yet.</p>
                </div>
              ) : (
                <div className="table-shell">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Assessment</TableHead>
                        <TableHead>Marks</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marks.map((mark, index) => (
                        <TableRow key={`${mark.course_code}-${mark.assessment_type}-${index}`}>
                          <TableCell>{mark.course_name ?? mark.course_code ?? '-'}</TableCell>
                          <TableCell>{mark.assessment_type}</TableCell>
                          <TableCell>
                            {mark.marks_obtained}/{mark.max_marks}
                          </TableCell>
                          <TableCell>{mark.percentage}%</TableCell>
                          <TableCell>
                            <span className="profile-pill">{mark.grade}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : null}

          {activeTab === 'attendance' ? (
            attendance.length === 0 ? (
              <div className="empty-state">
                <p>No attendance summary available yet.</p>
              </div>
            ) : (
              <div className="attendance-grid">
                {attendance.map((entry) => (
                  <article key={`${entry.course_id}-${entry.course_name}`} className="attendance-card">
                    <div className="attendance-card-top">
                      <div>
                        <p className="section-label">Course</p>
                        <h2>{entry.course_name ?? 'Pending course module'}</h2>
                      </div>
                      {entry.percentage < 75 ? (
                        <span className="status-badge status-inactive">Below 75%</span>
                      ) : (
                        <span className="status-badge status-active">Healthy</span>
                      )}
                    </div>
                    <div className="attendance-stats">
                      <p>Total classes: {entry.total_classes}</p>
                      <p>Present: {entry.present}</p>
                      <p>Absent: {entry.absent}</p>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${entry.percentage}%` }} />
                    </div>
                    <p className="attendance-percentage">{entry.percentage}% attendance</p>
                  </article>
                ))}
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      <StudentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
        student={student}
      />
    </main>
  )
}

export default StudentProfilePage
