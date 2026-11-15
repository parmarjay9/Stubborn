import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AgentStatus from '../components/AgentStatus'
import EvidencePacket from '../components/EvidencePacket'
import LetterView from '../components/LetterView'
import StepTrail from '../components/StepTrail'
import { api, type Claim, type Worker } from '../lib/api'
import { findingText } from '../lib/findings'
import { hoursText, money } from '../lib/format'
import { store } from '../lib/store'
import { getLang, t } from '../lib/i18n'

const WORKER_FIELDS: { name: keyof Worker; label: string; type: string; autoComplete: string; required?: boolean }[] = [
  { name: 'name', label: 'Your name', type: 'text', autoComplete: 'name', required: true },
  { name: 'employer', label: "Employer's name (as on your stub)", type: 'text', autoComplete: 'organization', required: true },
  { name: 'managerName', label: "Manager's first name (optional)", type: 'text', autoComplete: 'off' },
  { name: 'phone', label: 'Phone (optional)', type: 'tel', autoComplete: 'tel' },
  { name: 'email', label: 'Email (optional)', type: 'email', autoComplete: 'email' },
]

export default function Act() {
  const check = store.getCheck()
  const [params] = useSearchParams()
  const [worker, setWorker] = useState(store.getWorker)
  const [letters, setLetters] = useState(store.getLetters)
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const letterRef = useRef<HTMLElement>(null)
  const claimRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const target = params.get('do') === 'claim' ? claimRef.current : params.get('do') === 'letter' ? letterRef.current : null
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [params])

  if (!check) {
    return (
      <div className="grid gap-5">
        <div>
          <StepTrail current={3} />
          <h1 className="mt-3 text-4xl font-extrabold">{t('Take action')}</h1>
        </div>
        <div className="card text-center">
          <p className="font-semibold">{t('Check a pay stub first')}</p>
          <p className="mt-1 text-sm text-muted">{t('Once you have a result, you can write to your manager or get a claim form ready here.')}</p>
        </div>
        <Link to="/check" className="btn btn-primary">
          {t('Check my pay stub')}
        </Link>
      </div>
    )
  }

  const update = (name: keyof Worker, value: string) => {
    const next = { ...worker, [name]: value }
    setWorker(next)
    store.setWorker(next)
  }

  async function draft() {
    setDrafting(true)
    setError(null)
    try {
      const result = await api.letters(check!, worker, getLang())
      setLetters(result)
      store.setLetters(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('The draft did not come through. Please try again.'))
    } finally {
      setDrafting(false)
    }
  }

  // Words for the claim form. Uses the engine's own labels; no math happens here.
  const summary =
    letters?.complaintSummary ??
    check.findings
      .filter((f) => f.code !== 'ok')
      .map((f) => `${findingText(f).label}.`)
      .join(' ')

  const claim: Claim = {
    name: worker.name.trim(),
    phone: worker.phone.trim(),
    email: worker.email.trim(),
    employer: worker.employer.trim(),
    payPeriodStart: check.payPeriod.start,
    payPeriodEnd: check.payPeriod.end,
    hourlyRate: money(check.rate),
    hoursLogged: hoursText(check.totals.loggedHours),
    hoursPaid: hoursText(check.totals.paidHours),
    amountOwed: money(check.totals.owed),
    summary,
  }

  return (
    <div className="grid gap-5">
      <div>
        <StepTrail current={3} />
        <h1 className="mt-3 text-4xl font-extrabold">{t('Take action')}</h1>
        <p className="mt-1 text-muted">
          {check.totals.owed !== '0.00' ? t('{owed} possibly owed. Here are a few ways to ask about it.', { owed: money(check.totals.owed) }) : t('Your last check found nothing missing.')}
        </p>
      </div>

      <section className="card grid gap-3">
        <h2 className="text-xl font-extrabold">{t('About you')}</h2>
        {WORKER_FIELDS.map((field) => (
          <div key={field.name}>
            <label htmlFor={`worker-${field.name}`} className="label">
              {t(field.label)}
            </label>
            <input
              id={`worker-${field.name}`}
              className="field"
              type={field.type}
              autoComplete={field.autoComplete}
              value={worker[field.name]}
              onChange={(event) => update(field.name, event.target.value)}
            />
          </div>
        ))}
        <p className="text-xs text-muted">{t('Saved on this phone only, and sent just to write your note and fill the form.')}</p>
      </section>

      <section ref={letterRef} className="card grid scroll-mt-20 gap-3">
        <h2 className="text-xl font-extrabold">{t('1. Write to my manager')}</h2>
        <p className="text-sm text-muted">{t('A short, polite note that asks them to check the records. Most pay mix-ups get fixed this way.')}</p>
        {letters ? (
          <>
            <LetterView letters={letters} />
            <button type="button" className="text-sm font-semibold text-muted underline" disabled={drafting} onClick={draft}>
              {drafting ? t('Writing...') : t('Write it again')}
            </button>
          </>
        ) : drafting ? (
          <div className="grid gap-2" role="status" aria-label={t('Writing your note')}>
            <div className="skeleton h-11" />
            <div className="skeleton h-40" />
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={draft}>
            {t('Draft my note')}
          </button>
        )}
        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      </section>

      <section className="card grid gap-3">
        <h2 className="text-xl font-extrabold">
          {t('2. Make an evidence packet')}
          <span className="tag ml-2 rounded border-2 border-ink bg-hi px-1.5 py-0.5 align-middle" title={t('Part of Plus. Unlocked during sunhacks 2026.')}>Plus</span>
        </h2>
        <p className="text-sm text-muted">
          {t('One page with your result and the hours behind it, plus a QR code. Whoever scans it can check, on their own phone, that your log was never edited. Save it as a PDF to attach to an email or a claim.')}
        </p>
        <EvidencePacket check={check} worker={worker} />
      </section>

      <section ref={claimRef} className="card grid scroll-mt-20 gap-3">
        <h2 className="text-xl font-extrabold">
          {t('3. File a wage claim')}
          <span className="tag ml-2 rounded border-2 border-ink bg-hi px-1.5 py-0.5 align-middle" title={t('Part of Plus. Unlocked during sunhacks 2026.')}>Plus</span>
        </h2>
        <p className="text-sm text-muted">
          {t('A web agent fills in a claim form with your details and your numbers, then stops so you can review. It never presses submit.')}
        </p>
        <AgentStatus claim={claim} ready={Boolean(claim.name && claim.employer)} />
        <p className="text-xs leading-relaxed text-muted">
          {t('For this demo the agent fills a practice form, not a government one. Real unpaid wage claims in Arizona go to the Labor Department of the Industrial Commission of Arizona.')}
        </p>
      </section>
    </div>
  )
}
