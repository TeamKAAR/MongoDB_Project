import { useEffect, useMemo, useState } from 'react'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx'
import { apiRequest } from '../lib/api.js'
import { formatDate } from '../lib/utils.js'

function previewGrade(percentage) {
  if (!Number.isFinite(percentage)) {
    return { grade: '-', gpa: '-' }
  }
  if (percentage >= 90) return { grade: 'A+', gpa: 4.0 }
  if (percentage >= 80) return { grade: 'A', gpa: 3.7 }
  if (percentage >= 70) return { grade: 'B', gpa: 3.0 }
  if (percentage >= 60) return { grade: 'C', gpa: 2.0 }
  if (percentage >= 50) return { grade: 'D', gpa: 1.0 }
  return { grade: 'F', gpa: 0.0 }
}

const EMPTY_FORM = {
  student_id: '',
  course_id: '',
  assessment_type: 'Quiz',
  assessment_name: '',
  marks_obtained: '',
  max_marks: '',
  date: new Date().toISOString().slice(0, 10),
  remarks: '',
}

function normalizeMarksStudentPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { items: [], summary: null }
  }

  return {
    items: Array.isArray(payload.items) ? payload.items : [],
    summary: payload.summary && typeof payload.summary === 'object' ? payload.summary : null,
  }
}

function MarksPage() {
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [courseMarks, setCourseMarks] = useState([])
  const [studentMarks, setStudentMarks] = useState([])
  const [studentSummary, setStudentSummary] = useState(null)
  const [formValues, setFormValues] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [courseMarksError, setCourseMarksError] = useState('')
  const [studentMarksError, setStudentMarksError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadInitial = async () => {
      try {
        const [coursesPayload, studentsPayload] = await Promise.all([
          apiRequest('/api/v1/courses'),
          apiRequest('/api/v1/students?limit=100&status=active'),
        ])

        if (active) {
          const activeCourses = Array.isArray(coursesPayload)
            ? coursesPayload.filter((course) => course.status === 'active')
            : []
          const visibleStudents = Array.isArray(studentsPayload?.items)
            ? studentsPayload.items
            : []
          setCourses(activeCourses)
          setStudents(visibleStudents)
          setSelectedCourseId(activeCourses[0]?.id ?? '')
          setFormValues((current) => ({
            ...current,
            course_id: activeCourses[0]?.id ?? '',
            student_id: visibleStudents[0]?.id ?? '',
          }))
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

    loadInitial()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedCourseId) {
      setCourseMarks([])
      setCourseMarksError('')
      return
    }

    apiRequest(`/api/v1/marks/course/${selectedCourseId}`)
      .then((payload) => {
        setCourseMarks(Array.isArray(payload) ? payload : [])
        setCourseMarksError('')
      })
      .catch((requestError) => {
        setCourseMarks([])
        setCourseMarksError(requestError.message)
      })
  }, [selectedCourseId])

  useEffect(() => {
    if (!formValues.student_id) {
      setStudentMarks([])
      setStudentSummary(null)
      setStudentMarksError('')
      return
    }

    apiRequest(`/api/v1/marks/student/${formValues.student_id}`)
      .then((payload) => {
        const normalized = normalizeMarksStudentPayload(payload)
        setStudentMarks(normalized.items)
        setStudentSummary(normalized.summary)
        setStudentMarksError('')
      })
      .catch((requestError) => {
        setStudentMarks([])
        setStudentSummary(null)
        setStudentMarksError(requestError.message)
      })
  }, [formValues.student_id])

  const preview = useMemo(() => {
    const obtained = Number(formValues.marks_obtained)
    const max = Number(formValues.max_marks)
    if (!Number.isFinite(obtained) || !Number.isFinite(max) || formValues.marks_obtained === '' || formValues.max_marks === '' || max <= 0) {
      return { percentage: '-', grade: '-', gpa: '-' }
    }

    const percentage = Number(((obtained / max) * 100).toFixed(2))
    const { grade, gpa } = previewGrade(percentage)
    return { percentage, grade, gpa }
  }, [formValues.marks_obtained, formValues.max_marks])

  const handleChange = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)

    try {
      await apiRequest('/api/v1/marks', {
        method: 'POST',
        body: JSON.stringify({
          ...formValues,
          marks_obtained: Number(formValues.marks_obtained),
          max_marks: Number(formValues.max_marks),
          date: new Date(`${formValues.date}T00:00:00`).toISOString(),
        }),
        successMessage: 'Mark saved.',
        showSuccessToast: true,
      })
      setNotice('Mark saved.')
      setError('')
      const [coursePayload, studentPayload] = await Promise.all([
        apiRequest(`/api/v1/marks/course/${formValues.course_id}`),
        apiRequest(`/api/v1/marks/student/${formValues.student_id}`),
      ])
      setCourseMarks(coursePayload)
      setStudentMarks(studentPayload.items)
      setStudentSummary(studentPayload.summary)
      setFormValues((current) => ({
        ...EMPTY_FORM,
        course_id: current.course_id,
        student_id: current.student_id,
        date: new Date().toISOString().slice(0, 10),
      }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Marks module</p>
        <h1>Marks & Grades</h1>
        <p className="lead">
          Enter assessment scores, see the grade logic live, and review marks by
          course or student.
        </p>
      </section>

      {error ? <p className="error-box">{error}</p> : null}
      {notice ? <p className="success-box">{notice}</p> : null}

      <div className="marks-layout">
        <Card>
          <CardHeader>
            <CardTitle>Add mark</CardTitle>
            <CardDescription>Grade and GPA preview update as you type.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="empty-state">
                <p>Loading form data...</p>
              </div>
            ) : courses.length === 0 || students.length === 0 ? (
              <div className="empty-state">
                <p>
                  Marks entry is unavailable because there are no visible courses or
                  students for your account yet.
                </p>
              </div>
            ) : (
              <form className="student-form" onSubmit={handleSubmit}>
                <div className="form-grid form-grid-2">
                  <div className="field-group">
                    <Label htmlFor="mark_student">Student</Label>
                    <select
                      id="mark_student"
                      className="ui-select"
                      value={formValues.student_id}
                      onChange={(event) => handleChange('student_id', event.target.value)}
                    >
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name.first} {student.name.last} ({student.student_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field-group">
                    <Label htmlFor="mark_course">Course</Label>
                    <select
                      id="mark_course"
                      className="ui-select"
                      value={formValues.course_id}
                      onChange={(event) => {
                        handleChange('course_id', event.target.value)
                        setSelectedCourseId(event.target.value)
                      }}
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.course_code} - {course.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid form-grid-2">
                  <div className="field-group">
                    <Label htmlFor="assessment_type">Assessment type</Label>
                    <select
                      id="assessment_type"
                      className="ui-select"
                      value={formValues.assessment_type}
                      onChange={(event) => handleChange('assessment_type', event.target.value)}
                    >
                      <option value="Quiz">Quiz</option>
                      <option value="Assignment">Assignment</option>
                      <option value="Midterm">Midterm</option>
                      <option value="Final">Final</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <Label htmlFor="assessment_name">Assessment name</Label>
                    <Input
                      id="assessment_name"
                      value={formValues.assessment_name}
                      onChange={(event) => handleChange('assessment_name', event.target.value)}
                      placeholder="Unit Quiz 1"
                      required
                    />
                  </div>
                </div>

                <div className="form-grid form-grid-3">
                  <div className="field-group">
                    <Label htmlFor="marks_obtained">Marks obtained</Label>
                    <Input
                      id="marks_obtained"
                      type="number"
                      value={formValues.marks_obtained}
                      onChange={(event) => handleChange('marks_obtained', event.target.value)}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <Label htmlFor="max_marks">Max marks</Label>
                    <Input
                      id="max_marks"
                      type="number"
                      value={formValues.max_marks}
                      onChange={(event) => handleChange('max_marks', event.target.value)}
                      min="1"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="field-group">
                    <Label htmlFor="mark_date">Date</Label>
                    <Input
                      id="mark_date"
                      type="date"
                      value={formValues.date}
                      onChange={(event) => handleChange('date', event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="field-group">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Input
                    id="remarks"
                    value={formValues.remarks}
                    onChange={(event) => handleChange('remarks', event.target.value)}
                    placeholder="Optional note"
                  />
                </div>

                <div className="preview-card">
                  <p className="section-label">Live preview</p>
                  <div className="preview-grid">
                    <div>
                      <span>Percentage</span>
                      <strong>{preview.percentage === '-' ? '-' : `${preview.percentage}%`}</strong>
                    </div>
                    <div>
                      <span>Grade</span>
                      <strong>{preview.grade}</strong>
                    </div>
                    <div>
                      <span>GPA</span>
                      <strong>{preview.gpa}</strong>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save mark'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By course</CardTitle>
            <CardDescription>Review recorded marks for the selected course.</CardDescription>
          </CardHeader>
          <CardContent>
            {courseMarksError ? <p className="error-box">{courseMarksError}</p> : null}
            <div className="field-group">
              <Label htmlFor="course_filter">Course selector</Label>
              <select
                id="course_filter"
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

            {!selectedCourseId ? (
              <div className="empty-state">
                <p>No course is available for marks review.</p>
              </div>
            ) : courseMarks.length === 0 ? (
              <div className="empty-state">
                <p>No marks recorded for this course yet.</p>
              </div>
            ) : (
              <div className="table-shell marks-table">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Assessment</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>%</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>GPA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courseMarks.map((mark) => (
                      <TableRow key={mark.id}>
                        <TableCell>{mark.student_name}</TableCell>
                        <TableCell>{mark.assessment_name}</TableCell>
                        <TableCell>{mark.marks_obtained}/{mark.max_marks}</TableCell>
                        <TableCell>{mark.percentage}%</TableCell>
                        <TableCell>
                          <span className={`status-badge ${mark.grade === 'F' ? 'status-inactive' : 'status-active'}`}>
                            {mark.grade}
                          </span>
                        </TableCell>
                        <TableCell>{mark.gpa}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By student</CardTitle>
          <CardDescription>Quick summary for the currently selected student.</CardDescription>
        </CardHeader>
        <CardContent>
          {studentMarksError ? <p className="error-box">{studentMarksError}</p> : null}
          {studentSummary && studentSummary.overall_gpa != null ? (
            <div className="summary-strip">
              <div className="summary-card">
                <p className="section-label">Overall GPA</p>
                <p>{studentSummary.overall_gpa}</p>
              </div>
              <div className="summary-card">
                <p className="section-label">Average percentage</p>
                <p>{studentSummary.average_percentage}%</p>
              </div>
            </div>
          ) : null}

          {studentMarks.length === 0 ? (
            <div className="empty-state">
              <p>No marks recorded for this student yet.</p>
            </div>
          ) : (
            <div className="table-shell">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Assessment</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Recorded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentMarks.map((mark) => (
                    <TableRow key={mark.id}>
                      <TableCell>{mark.course_name}</TableCell>
                      <TableCell>{mark.assessment_name}</TableCell>
                      <TableCell>{mark.grade}</TableCell>
                      <TableCell>{formatDate(mark.date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default MarksPage
