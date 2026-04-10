import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StudentFormModal from '../components/students/StudentFormModal.jsx'
import { Button } from '../components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx'
import { Input } from '../components/ui/input.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx'
import { apiRequest } from '../lib/api.js'
import { avatarColor, formatDate, initials } from '../lib/utils.js'

const PAGE_SIZE = 20

function StudentsPage() {
  const [students, setStudents] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, pages: 1 })
  const [searchInput, setSearchInput] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1)
      setSearchValue(searchInput.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true

    const loadStudents = async () => {
      setIsLoading(true)

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        })

        if (searchValue) {
          params.set('search', searchValue)
        }

        if (statusFilter !== 'all') {
          params.set('status', statusFilter)
        }

        const payload = await apiRequest(`/api/v1/students?${params.toString()}`)

        if (active) {
          setStudents(payload.items)
          setPagination({ total: payload.total, pages: payload.pages })
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

    loadStudents()

    return () => {
      active = false
    }
  }, [page, searchValue, statusFilter])

  const openCreateModal = () => {
    setSelectedStudent(null)
    setIsModalOpen(true)
  }

  const openEditModal = (student) => {
    setSelectedStudent(student)
    setIsModalOpen(true)
  }

  const handleSaved = (savedStudent, message) => {
    setNotice(message)
    setStudents((current) => {
      const existingIndex = current.findIndex((student) => student.id === savedStudent.id)
      if (existingIndex === -1) {
        return [savedStudent, ...current].slice(0, PAGE_SIZE)
      }

      const next = [...current]
      next[existingIndex] = savedStudent
      return next
    })
  }

  const handleDelete = async (student) => {
    const confirmed = window.confirm(
      'Are you sure? This will deactivate the student.',
    )

    if (!confirmed) {
      return
    }

    try {
      const updatedStudent = await apiRequest(`/api/v1/students/${student.id}`, {
        method: 'DELETE',
        successMessage: 'Student deactivated.',
        showSuccessToast: true,
      })

      setStudents((current) =>
        current.map((item) => (item.id === updatedStudent.id ? updatedStudent : item)),
      )
      setNotice('Student deactivated.')
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const startItem = pagination.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, pagination.total)

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Students module</p>
        <h1>Students</h1>
        <p className="lead">
          Search, filter, create, edit, and deactivate student records from one
          place.
        </p>
      </section>

      <Card>
        <CardHeader className="split-header">
          <div>
            <CardTitle>Student registry</CardTitle>
            <CardDescription>
              Showing live data from the protected students API.
            </CardDescription>
          </div>
          <Button type="button" onClick={openCreateModal}>
            Add student
          </Button>
        </CardHeader>
        <CardContent>
          <div className="toolbar">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by name, email, or student ID"
            />
            <select
              className="ui-select"
              value={statusFilter}
              onChange={(event) => {
                setPage(1)
                setStatusFilter(event.target.value)
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
            </select>
          </div>

          {notice ? <p className="success-box">{notice}</p> : null}
          {error ? <p className="error-box">{error}</p> : null}

          {isLoading ? (
            <div className="empty-state">
              <p>Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="empty-state">
              <p>No students found for the current search and filter.</p>
            </div>
          ) : (
            <>
              <div className="table-shell">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enrolled</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <div className="student-cell">
                            <div
                              className="avatar-circle"
                              style={{ backgroundColor: avatarColor(student.student_id) }}
                            >
                              {initials(student.name)}
                            </div>
                            <Link className="student-link" to={`/students/${student.id}`}>
                              {student.name.first} {student.name.last}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell>{student.student_id}</TableCell>
                        <TableCell>{student.email}</TableCell>
                        <TableCell>{student.phone}</TableCell>
                        <TableCell>
                          <span className={`status-badge status-${student.status}`}>
                            {student.status}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(student.enrollment_date)}</TableCell>
                        <TableCell>
                          <div className="table-actions">
                            <Link className="text-button" to={`/students/${student.id}`}>
                              View
                            </Link>
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => openEditModal(student)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-button text-danger"
                              onClick={() => handleDelete(student)}
                            >
                              Delete
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="pagination-bar">
                <p>
                  Showing {startItem}-{endItem} of {pagination.total} students
                </p>
                <div className="pagination-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <span className="page-pill">
                    Page {page} of {pagination.pages}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page >= pagination.pages}
                    onClick={() =>
                      setPage((current) => Math.min(pagination.pages, current + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <StudentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
        student={selectedStudent}
      />
    </main>
  )
}

export default StudentsPage
