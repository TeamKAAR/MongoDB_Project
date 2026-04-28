import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import StudentFormModal from '../components/students/StudentFormModal.jsx'
import InteractionFormModal from '../components/mentorship/InteractionFormModal.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx'
import { Label } from '../components/ui/label.jsx'
import { apiRequest } from '../lib/api.js'
import { avatarColor, formatDate, initials } from '../lib/utils.js'
import { useAuthStore } from '../store/authStore.js'

const TABS = [
  { id: 'courses', label: 'Courses' },
  { id: 'marks', label: 'Marks' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'mentorship', label: 'Mentorship' },
]

const MEETING_TYPE_LABELS = {
  '1-on-1': '1-on-1 Meeting',
  academic_review: 'Academic Review',
  behavioral: 'Behavioral',
  check_in: 'Check-in',
}

function StudentProfilePage() {
  const user = useAuthStore((state) => state.user)
  const canEditStudent = user?.role === 'admin'
  const canAssignMentor = user?.role === 'admin' || user?.role === 'teacher'
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

  // Mentorship state (Sprint 6 + 7)
  const [mentorship, setMentorship] = useState(null)
  const [interactions, setInteractions] = useState([])
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false)

  // Mentor-assignment state (Sprint 6) — now for admin AND teacher
  const [teachers, setTeachers] = useState([])
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)
  const [assignNotice, setAssignNotice] = useState('')
  const [showReassign, setShowReassign] = useState(false)

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

        // Load mentorship data for admin, teacher, AND student
        try {
          const mentorshipData = await apiRequest(
            `/api/v1/mentorships/student/${studentId}`,
            { showErrorToast: false },
          )
          if (active) {
            setMentorship(mentorshipData)
            // Load interactions if any mentorship exists (current or past)
            try {
              const interactionsData = await apiRequest(
                `/api/v1/interactions/student/${studentId}`,
                { showErrorToast: false },
              )
              if (active) setInteractions(interactionsData?.items ?? [])
            } catch {
              // Non-critical
            }
          }
        } catch {
          // Mentorship might not exist, that's OK
        }

        // Load teachers list for mentor assignment (admin + teacher)
        if (canAssignMentor) {
          try {
            const teachersList = await apiRequest('/api/v1/mentorships/teachers', {
              showErrorToast: false,
            })
            if (active) setTeachers(teachersList)
          } catch {
            // Non-critical
          }
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
  }, [studentId, user])

  const handleSaved = (savedStudent, message) => {
    setStudent(savedStudent)
    setNotice(message)
  }

  const handleAssignMentor = async () => {
    if (!selectedTeacherId) return
    setIsAssigning(true)
    setAssignNotice('')
    try {
      const result = await apiRequest('/api/v1/mentorships', {
        method: 'POST',
        body: JSON.stringify({ teacher_id: selectedTeacherId, student_id: studentId }),
        successMessage: mentorship ? 'Mentor reassigned successfully.' : 'Mentor assigned successfully.',
        showSuccessToast: true,
      })
      setMentorship(result)
      setAssignNotice(mentorship ? 'Mentor reassigned successfully.' : 'Mentor assigned successfully.')
      setShowReassign(false)
      setSelectedTeacherId('')
    } catch (err) {
      setAssignNotice(err.message)
    } finally {
      setIsAssigning(false)
    }
  }

  const handleInteractionSaved = (saved) => {
    setInteractions((prev) => [saved, ...prev])
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

  const canLogInteraction =
    mentorship?.id &&
    (user?.role === 'admin' || (user?.role === 'teacher' && mentorship?.teacher_id === user?.id))

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

            {canEditStudent ? (
              <Button type="button" onClick={() => setIsModalOpen(true)}>
                Edit student
              </Button>
            ) : null}
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

          {/* Mentor info badge */}
          {mentorship ? (
            <div className="mentor-badge-strip">
              <p className="section-label">Current Mentor</p>
              <div className="badge-row">
                <span className="profile-pill">{mentorship.teacher_name ?? 'Assigned'}</span>
                <span className={`status-badge status-${mentorship.status}`}>
                  {mentorship.status}
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Mentor assignment section — visible for admin AND teacher */}
      {canAssignMentor ? (
        <Card>
          <CardHeader>
            <CardTitle>Mentor Assignment</CardTitle>
            <CardDescription>
              {mentorship
                ? `Currently mentored by ${mentorship.teacher_name ?? 'a teacher'}.`
                : 'Assign a mentor teacher to this student.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignNotice ? <p className="success-box">{assignNotice}</p> : null}
            {mentorship && !showReassign ? (
              <div className="mentor-assignment-current">
                <div className="dashboard-list-item">
                  <div>
                    <strong>{mentorship.teacher_name ?? 'Teacher'}</strong>
                    <p>Assigned {formatDate(mentorship.assigned_date)}</p>
                  </div>
                  <div className="table-actions">
                    <span className={`status-badge status-${mentorship.status}`}>
                      {mentorship.status}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowReassign(true)}
                    >
                      Change mentor
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="form-grid form-grid-2">
                <div className="field-group">
                  <Label htmlFor="mentor_select">Select teacher</Label>
                  <select
                    id="mentor_select"
                    className="ui-select"
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                  >
                    <option value="">— Choose a teacher —</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-group" style={{ alignSelf: 'end' }}>
                  <div className="table-actions">
                    <Button
                      type="button"
                      disabled={!selectedTeacherId || isAssigning}
                      onClick={handleAssignMentor}
                    >
                      {isAssigning ? 'Assigning...' : mentorship ? 'Reassign mentor' : 'Assign mentor'}
                    </Button>
                    {showReassign ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => { setShowReassign(false); setSelectedTeacherId('') }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Academic tabs</CardTitle>
          <CardDescription>
            The profile is ready for the course, marks, attendance, and mentorship modules.
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

          {/* Sprint 7: Mentorship tab — visible to all roles */}
          {activeTab === 'mentorship' ? (
            <div>
              {/* Log interaction button (only for admin/teacher) */}
              {canLogInteraction ? (
                <div style={{ marginBottom: '18px' }}>
                  <Button
                    type="button"
                    onClick={() => setIsInteractionModalOpen(true)}
                  >
                    Log new interaction
                  </Button>
                </div>
              ) : null}

              {!mentorship && interactions.length === 0 ? (
                <div className="empty-state">
                  <p>No mentorship history for this student.</p>
                </div>
              ) : interactions.length === 0 ? (
                <div className="empty-state">
                  <p>No interactions logged yet.{canLogInteraction ? ' Use the button above to log the first meeting.' : ''}</p>
                </div>
              ) : (
                <div className="timeline">
                  {interactions.map((interaction) => (
                    <article key={interaction.id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <div className="badge-row">
                            <span className="profile-pill">
                              {MEETING_TYPE_LABELS[interaction.type] ?? interaction.type}
                            </span>
                            <time className="timeline-date">
                              {formatDate(interaction.meeting_date)}
                            </time>
                          </div>
                          {interaction.logged_by_name ? (
                            <p className="mentee-card-meta">
                              Logged by {interaction.logged_by_name}
                            </p>
                          ) : null}
                        </div>
                        <p className="timeline-remarks">{interaction.remarks}</p>
                        {interaction.action_items?.length > 0 ? (
                          <div className="timeline-actions">
                            <p className="section-label">Action items</p>
                            <ul>
                              {interaction.action_items.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {interaction.next_meeting_date ? (
                          <p className="timeline-next">
                            Next meeting: {formatDate(interaction.next_meeting_date)}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <StudentFormModal
        isOpen={canEditStudent && isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
        student={student}
      />

      <InteractionFormModal
        isOpen={isInteractionModalOpen}
        onClose={() => setIsInteractionModalOpen(false)}
        onSaved={handleInteractionSaved}
        mentorshipId={mentorship?.id}
      />
    </main>
  )
}

export default StudentProfilePage
