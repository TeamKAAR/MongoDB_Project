import { useEffect, useState } from 'react'
import { Button } from '../ui/button.jsx'
import { Input } from '../ui/input.jsx'
import { Label } from '../ui/label.jsx'
import { apiRequest } from '../../lib/api.js'

const MEETING_TYPES = [
  { value: '1-on-1', label: '1-on-1 Meeting' },
  { value: 'academic_review', label: 'Academic Review' },
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'check_in', label: 'Check-in' },
]

const EMPTY_FORM = {
  meeting_date: '',
  type: '1-on-1',
  remarks: '',
  action_items_text: '',
  next_meeting_date: '',
}

function InteractionFormModal({ isOpen, onClose, onSaved, mentorshipId }) {
  const [formValues, setFormValues] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFormValues({
        ...EMPTY_FORM,
        meeting_date: new Date().toISOString().slice(0, 10),
      })
      setErrors({})
      setIsSaving(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const updateField = (field, value) => {
    setFormValues((current) => ({ ...current, [field]: value }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!formValues.meeting_date) nextErrors.meeting_date = 'Meeting date is required.'
    if (!formValues.remarks.trim()) nextErrors.remarks = 'Remarks are required.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setIsSaving(true)
    try {
      const actionItems = formValues.action_items_text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

      const payload = {
        mentorship_id: mentorshipId,
        meeting_date: new Date(`${formValues.meeting_date}T00:00:00`).toISOString(),
        type: formValues.type,
        remarks: formValues.remarks,
        action_items: actionItems,
        next_meeting_date: formValues.next_meeting_date
          ? new Date(`${formValues.next_meeting_date}T00:00:00`).toISOString()
          : null,
      }

      const saved = await apiRequest('/api/v1/interactions', {
        method: 'POST',
        body: JSON.stringify(payload),
        successMessage: 'Interaction logged.',
        showSuccessToast: true,
      })

      onSaved(saved)
      onClose()
    } catch (err) {
      setErrors((current) => ({ ...current, form: err.message }))
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
        aria-label="Log interaction"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="section-label">Mentorship</p>
            <h2>Log new interaction</h2>
          </div>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <form className="student-form" onSubmit={handleSubmit}>
          <div className="form-grid form-grid-2">
            <div className="field-group">
              <Label htmlFor="interaction_date">Meeting date</Label>
              <Input
                id="interaction_date"
                type="date"
                value={formValues.meeting_date}
                onChange={(e) => updateField('meeting_date', e.target.value)}
              />
              {errors.meeting_date ? <p className="field-error">{errors.meeting_date}</p> : null}
            </div>
            <div className="field-group">
              <Label htmlFor="interaction_type">Type</Label>
              <select
                id="interaction_type"
                className="ui-select"
                value={formValues.type}
                onChange={(e) => updateField('type', e.target.value)}
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-group">
            <Label htmlFor="interaction_remarks">Remarks</Label>
            <textarea
              id="interaction_remarks"
              className="ui-input"
              rows={4}
              value={formValues.remarks}
              onChange={(e) => updateField('remarks', e.target.value)}
              placeholder="Describe the meeting discussion..."
            />
            {errors.remarks ? <p className="field-error">{errors.remarks}</p> : null}
          </div>

          <div className="field-group">
            <Label htmlFor="interaction_actions">Action items (one per line)</Label>
            <textarea
              id="interaction_actions"
              className="ui-input"
              rows={3}
              value={formValues.action_items_text}
              onChange={(e) => updateField('action_items_text', e.target.value)}
              placeholder="E.g. Complete assignment 3&#10;Revise chapter 5"
            />
          </div>

          <div className="field-group">
            <Label htmlFor="next_meeting">Next meeting date</Label>
            <Input
              id="next_meeting"
              type="date"
              value={formValues.next_meeting_date}
              onChange={(e) => updateField('next_meeting_date', e.target.value)}
            />
          </div>

          {errors.form ? <p className="error-box">{errors.form}</p> : null}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Log interaction'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default InteractionFormModal
