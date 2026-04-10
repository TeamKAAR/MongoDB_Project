import { useEffect, useState } from 'react'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { Label } from '../components/ui/label.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx'
import { apiRequest } from '../lib/api.js'
import { formatDate } from '../lib/utils.js'

const DEFAULT_STATUS = 'present'

function AttendancePage() {
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState([])
  const [reportStudentId, setReportStudentId] = useState('')
  const [reportSummary, setReportSummary] = useState([])
  const [reportRecords, setReportRecords] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let active = true

    const loadInitial = async () => {
      try {
        const [coursesPayload, studentsPayload] = await Promise.all([
          apiRequest('/api/v1/courses'),
          apiRequest('/api/v1/students?limit=100&status=active'),
        ])

        if (active) {
          const activeCourses = coursesPayload.filter((course) => course.status === 'active')
          setCourses(activeCourses)
          setStudents(studentsPayload.items)
          setSelectedCourseId(activeCourses[0]?.id ?? '')
          setReportStudentId(studentsPayload.items[0]?.id ?? '')
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message)
        }
      }
    }

    loadInitial()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedCourseId) {
      return
    }

    const loadEnrollments = async () => {
      try {
        const [enrollmentsPayload, attendancePayload] = await Promise.all([
          apiRequest(`/api/v1/enrollments/course/${selectedCourseId}`),
          apiRequest(`/api/v1/attendance/course/${selectedCourseId}?date=${new Date(`${selectedDate}T00:00:00`).toISOString()}`),
        ])

        const attendanceByStudent = new Map(
          attendancePayload.map((record) => [record.student_id, record.status]),
        )

        setRows(
          enrollmentsPayload.map((enrollment) => ({
            student_id: enrollment.student_id,
            student_name: enrollment.student_name,
            student_code: enrollment.student_code,
            status: attendanceByStudent.get(enrollment.student_id) ?? DEFAULT_STATUS,
          })),
        )
        setError('')
      } catch (requestError) {
        setError(requestError.message)
      }
    }

    loadEnrollments()
  }, [selectedCourseId, selectedDate])

  useEffect(() => {
    if (!reportStudentId) {
      return
    }

    Promise.all([
      apiRequest(`/api/v1/attendance/student/${reportStudentId}/summary`),
      apiRequest(`/api/v1/attendance/student/${reportStudentId}`),
    ])
      .then(([summaryPayload, recordsPayload]) => {
        setReportSummary(summaryPayload)
        setReportRecords(recordsPayload)
        setError('')
      })
      .catch((requestError) => setError(requestError.message))
  }, [reportStudentId])

  const updateStatus = (studentId, status) => {
    setRows((current) =>
      current.map((row) => (row.student_id === studentId ? { ...row, status } : row)),
    )
  }

  const setAllStatuses = (status) => {
    setRows((current) => current.map((row) => ({ ...row, status })))
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      await apiRequest('/api/v1/attendance/bulk', {
        method: 'POST',
        body: JSON.stringify({
          course_id: selectedCourseId,
          date: new Date(`${selectedDate}T00:00:00`).toISOString(),
          items: rows.map((row) => ({
            student_id: row.student_id,
            status: row.status,
          })),
        }),
        successMessage: 'Attendance saved.',
        showSuccessToast: true,
      })
      setNotice('Attendance saved.')
      setError('')
      if (reportStudentId) {
        const [summaryPayload, recordsPayload] = await Promise.all([
          apiRequest(`/api/v1/attendance/student/${reportStudentId}/summary`),
          apiRequest(`/api/v1/attendance/student/${reportStudentId}`),
        ])
        setReportSummary(summaryPayload)
        setReportRecords(recordsPayload)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Attendance module</p>
        <h1>Attendance</h1>
        <p className="lead">
          Load a course roster, default everyone to present, and save attendance
          in one bulk action.
        </p>
      </section>

      {error ? <p className="error-box">{error}</p> : null}
      {notice ? <p className="success-box">{notice}</p> : null}

      <div className="marks-layout">
        <Card>
          <CardHeader>
            <CardTitle>Bulk attendance</CardTitle>
            <CardDescription>All students default to present for quick marking.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="form-grid form-grid-2">
              <div className="field-group">
                <Label htmlFor="attendance_course">Course</Label>
                <select
                  id="attendance_course"
                  className="ui-select"
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code} - {course.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <Label htmlFor="attendance_date">Date</Label>
                <input
                  id="attendance_date"
                  className="ui-input"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
            </div>

            <div className="quick-actions">
              <Button type="button" variant="secondary" onClick={() => setAllStatuses('present')}>
                Mark all present
              </Button>
              <Button type="button" variant="secondary" onClick={() => setAllStatuses('absent')}>
                Mark all absent
              </Button>
            </div>

            {rows.length === 0 ? (
              <div className="empty-state">
                <p>No enrolled students for this course yet.</p>
              </div>
            ) : (
              <div className="table-shell">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.student_id}>
                        <TableCell>{row.student_name}</TableCell>
                        <TableCell>{row.student_code}</TableCell>
                        <TableCell>
                          <select
                            className="ui-select"
                            value={row.status}
                            onChange={(event) => updateStatus(row.student_id, event.target.value)}
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late</option>
                            <option value="excused">Excused</option>
                          </select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="modal-actions">
              <Button type="button" onClick={handleSave} disabled={isSaving || rows.length === 0}>
                {isSaving ? 'Saving...' : 'Save attendance'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance report</CardTitle>
            <CardDescription>Review student attendance percentage and detailed records.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="field-group">
              <Label htmlFor="attendance_student">Student</Label>
              <select
                id="attendance_student"
                className="ui-select"
                value={reportStudentId}
                onChange={(event) => setReportStudentId(event.target.value)}
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name.first} {student.name.last} ({student.student_id})
                  </option>
                ))}
              </select>
            </div>

            {reportSummary.length === 0 ? (
              <div className="empty-state">
                <p>No attendance summary available for this student yet.</p>
              </div>
            ) : (
              <div className="attendance-grid">
                {reportSummary.map((entry) => (
                  <article key={`${entry.course_id}-${entry.course_name}`} className="attendance-card">
                    <div className="attendance-card-top">
                      <div>
                        <p className="section-label">Course</p>
                        <h2>{entry.course_name}</h2>
                      </div>
                      {entry.percentage < 75 ? (
                        <span className="status-badge status-inactive">Under 75%</span>
                      ) : (
                        <span className="status-badge status-active">On track</span>
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
            )}

            <div className="table-shell attendance-records">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{record.course_name}</TableCell>
                      <TableCell>{record.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

export default AttendancePage
