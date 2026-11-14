import { useState } from 'react'
import type { StubFieldName, StubFields } from '../lib/api'

const FIELDS: { name: StubFieldName; label: string; kind: 'date' | 'money' | 'hours' }[] = [
  { name: 'payPeriodStart', label: 'Pay period start', kind: 'date' },
  { name: 'payPeriodEnd', label: 'Pay period end', kind: 'date' },
  { name: 'hourlyRate', label: 'Hourly rate ($)', kind: 'money' },
  { name: 'regularHoursPaid', label: 'Regular hours paid', kind: 'hours' },
  { name: 'overtimeHoursPaid', label: 'Overtime hours paid', kind: 'hours' },
  { name: 'grossPay', label: 'Gross pay ($)', kind: 'money' },
]

const LOW_CONFIDENCE = 80

export default function ConfirmFields({
  initial,
  confidence,
  busy,
  error,
  onConfirm,
}: {
  initial: StubFields
  /** Textract confidence per field, 0 to 100. Missing means the worker typed it. */
  confidence: Partial<Record<StubFieldName, number>>
  busy: boolean
  error: string | null
  onConfirm: (fields: StubFields) => void
}) {
  const [values, setValues] = useState(initial)
  const [touched, setTouched] = useState<Partial<Record<StubFieldName, boolean>>>({})

  const missing = FIELDS.filter((f) => values[f.name].trim() === '')

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (missing.length === 0) onConfirm(values)
      }}
    >
      <div className="card grid grid-cols-2 gap-x-3 gap-y-4">
        {FIELDS.map((field) => {
          const score = confidence[field.name]
          const unsure = score !== undefined && score < LOW_CONFIDENCE && !touched[field.name]
          return (
            <div key={field.name} className={field.kind === 'date' ? 'col-span-2 sm:col-span-1' : ''}>
              <label htmlFor={field.name} className="label">
                {field.label}
              </label>
              <input
                id={field.name}
                className={`field font-mono ${unsure ? '!border-warn bg-warn-soft' : ''}`}
                type={field.kind === 'date' ? 'date' : 'text'}
                inputMode={field.kind === 'date' ? undefined : 'decimal'}
                placeholder={field.kind === 'date' ? undefined : '0.00'}
                value={values[field.name]}
                onChange={(event) => {
                  setValues({ ...values, [field.name]: event.target.value })
                  setTouched({ ...touched, [field.name]: true })
                }}
              />
              {unsure && <p className="mt-1 text-xs font-semibold text-warn">Please check this.</p>}
            </div>
          )
        })}
      </div>

      {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={busy || missing.length > 0}>
        {busy ? 'Checking...' : 'Looks right, check my pay'}
      </button>
      {missing.length > 0 && <p className="text-center text-sm text-muted">Fill in every box to continue.</p>}
    </form>
  )
}
