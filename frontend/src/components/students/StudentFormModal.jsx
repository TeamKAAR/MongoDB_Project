import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/button.jsx'
import { Input } from '../ui/input.jsx'
import { Label } from '../ui/label.jsx'
import { apiRequest } from '../../lib/api.js'
import { toDateInputValue } from '../../lib/utils.js'

const EMPTY_FORM = {
  name: { first: '', last: '' },
  email: '',
  phone: '',
  date_of_birth: '',
  gender: 'Male',
  status: 'active',
  enrollment_date: '',
  address: {
    street: '',
    city: '',
    state: '',
    pincode: '',
  },
  profile_image: '',
}

function toPayload(formValues) {
  return {
    ...formValues,
    date_of_birth: new Date(`${formValues.date_of_birth}T00:00:00`).toISOString(),
    enrollment_date: new Date(`${formValues.enrollment_date}T00:00:00`).toISOString(),
  }
}

function getInitialValues(student) {
  if (!student) {
    return {
      ...EMPTY_FORM,
      enrollment_date: new Date().toISOString().slice(0, 10),
    }
  }

  return {
    name: {
      first: student.name.first,
      last: student.name.last,
    },
    email: student.email,
    phone: student.phone,
    date_of_birth: toDateInputValue(student.date_of_birth),
    gender: student.gender,
    status: student.status,
    enrollment_date: toDateInputValue(student.enrollment_date),
    address: {
      street: student.address.street,
      city: student.address.city,
      state: student.address.state,
      pincode: student.address.pincode,
    },
    profile_image: student.profile_image ?? '',
  }
}

function StudentFormModal({ isOpen, onClose, onSaved, student }) {
  const [formValues, setFormValues] = useState(() => getInitialValues(student))
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormValues(getInitialValues(student))
      setErrors({})
      setIsSaving(false)
    }
  }, [isOpen, student])

  const isEditMode = useMemo(() => Boolean(student?.id), [student])

  if (!isOpen) {
    return null
  }

  const updateField = (path, value) => {
    setFormValues((current) => {
      const next = structuredClone(current)
      let pointer = next

      for (let index = 0; index < path.length - 1; index += 1) {
        pointer = pointer[path[index]]
      }

      pointer[path[path.length - 1]] = value
      return next
    })
  }

  const validate = () => {
    const nextErrors = {}
    const dob = new Date(formValues.date_of_birth)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const hasBirthdayPassed =
      today.getMonth() > dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate())

    if (!hasBirthdayPassed) {
      age -= 1
    }

    if (!formValues.name.first.trim()) {
      nextErrors.firstName = 'First name is required.'
    }
    if (!formValues.name.last.trim()) {
      nextErrors.lastName = 'Last name is required.'
    }
    if (!/^\S+@\S+\.\S+$/.test(formValues.email)) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (!/^\d{10}$/.test(formValues.phone)) {
      nextErrors.phone = 'Phone must be exactly 10 digits.'
    }
    if (Number.isNaN(dob.getTime()) || age < 15) {
      nextErrors.date_of_birth = 'Student must be at least 15 years old.'
    }
    if (!formValues.enrollment_date) {
      nextErrors.enrollment_date = 'Enrollment date is required.'
    }
    if (!formValues.address.street.trim()) {
      nextErrors.street = 'Street is required.'
    }
    if (!formValues.address.city.trim()) {
      nextErrors.city = 'City is required.'
    }
    if (!formValues.address.state.trim()) {
      nextErrors.state = 'State is required.'
    }
    if (!formValues.address.pincode.trim()) {
      nextErrors.pincode = 'Pincode is required.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!validate()) {
      return
    }

    setIsSaving(true)

    try {
      const payload = toPayload(formValues)
      const savedStudent = await apiRequest(
        isEditMode ? `/api/v1/students/${student.id}` : '/api/v1/students',
        {
          method: isEditMode ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
          successMessage: isEditMode ? 'Student updated.' : 'Student created.',
          showSuccessToast: true,
        },
      )

      onSaved(savedStudent, isEditMode ? 'Student updated.' : 'Student created.')
      onClose()
    } catch (error) {
      setErrors((current) => ({ ...current, form: error.message }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? 'Edit student' : 'Add student'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="section-label">{isEditMode ? 'Edit student' : 'Add student'}</p>
            <h2>{isEditMode ? `${student.name.first} ${student.name.last}` : 'Create student profile'}</h2>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <form className="student-form" onSubmit={handleSubmit}>
          {isEditMode ? (
            <div className="field-group">
              <Label htmlFor="student_id">Student ID</Label>
              <Input id="student_id" value={student.student_id} readOnly />
            </div>
          ) : null}

          <div className="form-grid form-grid-2">
            <div className="field-group">
              <Label htmlFor="first_name">First name</Label>
              <Input
                id="first_name"
                value={formValues.name.first}
                onChange={(event) => updateField(['name', 'first'], event.target.value)}
              />
              {errors.firstName ? <p className="field-error">{errors.firstName}</p> : null}
            </div>
            <div className="field-group">
              <Label htmlFor="last_name">Last name</Label>
              <Input
                id="last_name"
                value={formValues.name.last}
                onChange={(event) => updateField(['name', 'last'], event.target.value)}
              />
              {errors.lastName ? <p className="field-error">{errors.lastName}</p> : null}
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="field-group">
              <Label htmlFor="student_email">Email</Label>
              <Input
                id="student_email"
                type="email"
                value={formValues.email}
                onChange={(event) => updateField(['email'], event.target.value)}
              />
              {errors.email ? <p className="field-error">{errors.email}</p> : null}
            </div>
            <div className="field-group">
              <Label htmlFor="student_phone">Phone</Label>
              <Input
                id="student_phone"
                value={formValues.phone}
                onChange={(event) => updateField(['phone'], event.target.value)}
              />
              {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
            </div>
          </div>

          <div className="form-grid form-grid-3">
            <div className="field-group">
              <Label htmlFor="student_gender">Gender</Label>
              <select
                id="student_gender"
                className="ui-select"
                value={formValues.gender}
                onChange={(event) => updateField(['gender'], event.target.value)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field-group">
              <Label htmlFor="student_dob">Date of birth</Label>
              <Input
                id="student_dob"
                type="date"
                value={formValues.date_of_birth}
                onChange={(event) => updateField(['date_of_birth'], event.target.value)}
              />
              {errors.date_of_birth ? <p className="field-error">{errors.date_of_birth}</p> : null}
            </div>
            <div className="field-group">
              <Label htmlFor="student_status">Status</Label>
              <select
                id="student_status"
                className="ui-select"
                value={formValues.status}
                onChange={(event) => updateField(['status'], event.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
              </select>
            </div>
          </div>

          <div className="field-group">
            <Label htmlFor="enrollment_date">Enrollment date</Label>
            <Input
              id="enrollment_date"
              type="date"
              value={formValues.enrollment_date}
              onChange={(event) => updateField(['enrollment_date'], event.target.value)}
            />
            {errors.enrollment_date ? <p className="field-error">{errors.enrollment_date}</p> : null}
          </div>

          <div className="form-grid form-grid-2">
            <div className="field-group">
              <Label htmlFor="street">Street</Label>
              <Input
                id="street"
                value={formValues.address.street}
                onChange={(event) => updateField(['address', 'street'], event.target.value)}
              />
              {errors.street ? <p className="field-error">{errors.street}</p> : null}
            </div>
            <div className="field-group">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formValues.address.city}
                onChange={(event) => updateField(['address', 'city'], event.target.value)}
              />
              {errors.city ? <p className="field-error">{errors.city}</p> : null}
            </div>
          </div>

          <div className="form-grid form-grid-2">
            <div className="field-group">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formValues.address.state}
                onChange={(event) => updateField(['address', 'state'], event.target.value)}
              />
              {errors.state ? <p className="field-error">{errors.state}</p> : null}
            </div>
            <div className="field-group">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                value={formValues.address.pincode}
                onChange={(event) => updateField(['address', 'pincode'], event.target.value)}
              />
              {errors.pincode ? <p className="field-error">{errors.pincode}</p> : null}
            </div>
          </div>

          {errors.form ? <p className="error-box">{errors.form}</p> : null}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isEditMode ? 'Save changes' : 'Create student'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default StudentFormModal
