import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// A practice form for the web agent to fill. It is deliberately plain and
// carries no agency name, seal or colors. It sends nothing anywhere.
// With ?agent=1 the Submit button is disabled, so an agent cannot submit it
// even if it ignored its instructions.

const FIELDS: { name: string; label: string; type?: string; half?: boolean }[] = [
  { name: 'name', label: 'Full name' },
  { name: 'phone', label: 'Phone', type: 'tel', half: true },
  { name: 'email', label: 'Email', type: 'email', half: true },
  { name: 'employer', label: 'Employer name' },
  { name: 'payPeriodStart', label: 'Pay period start', type: 'date', half: true },
  { name: 'payPeriodEnd', label: 'Pay period end', type: 'date', half: true },
  { name: 'hourlyRate', label: 'Hourly rate', half: true },
  { name: 'amountOwed', label: 'Amount possibly owed', half: true },
  { name: 'hoursLogged', label: 'Hours worked (from your own log)', half: true },
  { name: 'hoursPaid', label: 'Hours paid on the pay stub', half: true },
]

export default function DemoClaimForm() {
  const [params] = useSearchParams()
  const agentMode = params.get('agent') === '1'
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries([...FIELDS.map((f) => f.name), 'summary'].map((name) => [name, params.get(name) ?? ''])),
  )
  const [sent, setSent] = useState(false)

  const set = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }))

  return (
    <div className="min-h-dvh bg-white">
      <div role="alert" className="bg-warn-soft px-4 py-3 text-center font-bold text-warn">
        Demo wage claim form. Not a government website.
      </div>

      <main className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-2xl font-black tracking-tight">Practice wage claim form</h1>
        <p className="mt-1 text-sm text-muted">
          Part of the Stubborn demo at sunhacks 2026. Nothing typed here is sent or saved anywhere.
        </p>

        {sent ? (
          <div className="mt-6 rounded-2xl bg-accent-soft p-5 text-accent-dark">
            <p className="font-bold">This is a demo form. Nothing was sent.</p>
            <p className="mt-1 text-sm">
              To file a real unpaid wage claim in Arizona, use the Unpaid Wage Claim Form from the Labor Department of
              the Industrial Commission of Arizona.
            </p>
            <button type="button" className="mt-3 text-sm font-semibold underline" onClick={() => setSent(false)}>
              Back to the form
            </button>
          </div>
        ) : (
          <form
            className="mt-6 grid grid-cols-2 gap-x-3 gap-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!agentMode) setSent(true)
            }}
          >
            {FIELDS.map((field) => (
              <div key={field.name} className={field.half ? 'col-span-2 sm:col-span-1' : 'col-span-2'}>
                <label htmlFor={field.name} className="label">
                  {field.label}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type ?? 'text'}
                  className="field"
                  value={values[field.name]}
                  onChange={(event) => set(field.name, event.target.value)}
                />
              </div>
            ))}
            <div className="col-span-2">
              <label htmlFor="summary" className="label">
                Description of the claim
              </label>
              <textarea
                id="summary"
                name="summary"
                rows={7}
                className="field py-2"
                value={values.summary}
                onChange={(event) => set('summary', event.target.value)}
              />
            </div>

            <div className="col-span-2 grid gap-2">
              <button type="submit" className="btn btn-primary" disabled={agentMode}>
                Submit
              </button>
              {agentMode && (
                <p className="text-center text-sm text-muted">
                  Submit is switched off while the agent fills this in. The worker reviews it first.
                </p>
              )}
            </div>
          </form>
        )}

        <footer className="mt-10 border-t border-line pt-5 text-center text-sm text-muted">
          Demo page built by Jay Parmar at sunhacks 2026. Not affiliated with any government agency.
        </footer>
      </main>
    </div>
  )
}
