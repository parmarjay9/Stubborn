import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { getLang, t } from '../lib/i18n'

export type WaitlistPlan = 'plus' | 'partners'

const DONE_KEY = 'stubborn.waitlist'

export function joinedPlans(): WaitlistPlan[] {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) || '[]')
  } catch {
    return []
  }
}

function remember(plan: WaitlistPlan) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...joinedPlans(), plan])]))
  } catch {
    // fine: the form just shows again next time
  }
}

/** Shown after "Notify me" or "Talk to us". Saves an email; charges nothing. */
export default function WaitlistForm({ plan, onClose }: { plan: WaitlistPlan; onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(() => joinedPlans().includes(plan))
  const partners = plan === 'partners'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.joinWaitlist({ email, plan, lang: getLang(), organization: partners ? organization : '' })
      remember(plan)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('That did not go through. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <section role="status" className="pop card grid gap-3 border-accent bg-accent-soft">
        <p className="tag text-accent-dark">{partners ? t('Partners') : t('Plus')}</p>
        <h2 className="text-2xl font-extrabold text-accent-dark">{partners ? t('Thanks, we will be in touch') : t('You are on the list')}</h2>
        <p className="text-[0.95rem] leading-snug">
          {partners
            ? t('We will email you about bringing Stubborn to your members.')
            : t('We will send you one email when Plus opens. Nothing was charged, and you can keep using everything for free until then.')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link to="/log" className="btn btn-primary">
            {t('Keep using Stubborn')}
          </Link>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Close')}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="pop card grid gap-4" aria-labelledby="waitlist-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tag text-muted">{partners ? t('Partners') : t('Plus, $3 a month')}</p>
          <h2 id="waitlist-title" className="mt-1 text-2xl font-extrabold">
            {partners ? t('Bring Stubborn to your members') : t('Get told when Plus opens')}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border-2 border-ink/30 text-xl font-bold" aria-label={t('Close')}>
          ×
        </button>
      </div>

      <ol className="grid gap-2 text-[0.95rem]">
        {(partners
          ? ['Leave your email and organization.', 'We reach out to set up seats for your members.', 'Your members get Plus at no cost to them.']
          : ['Leave your email. That is all for now.', 'When Plus opens, we send you one email.', 'You choose whether to subscribe then. Card details are taken on a secure payment page, never here.']
        ).map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-hi font-mono text-sm font-bold">{index + 1}</span>
            <span className="pt-0.5 leading-snug">{t(step)}</span>
          </li>
        ))}
      </ol>

      <form className="grid gap-3" onSubmit={submit}>
        <div>
          <label htmlFor="waitlist-email" className="label">
            {t('Email')}
          </label>
          <input
            id="waitlist-email"
            className="field"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('you@example.com')}
          />
        </div>
        {partners && (
          <div>
            <label htmlFor="waitlist-org" className="label">
              {t('Organization')}
            </label>
            <input
              id="waitlist-org"
              className="field"
              type="text"
              autoComplete="organization"
              required
              maxLength={120}
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder={t('Union, worker center or clinic')}
            />
          </div>
        )}
        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('Saving...') : partners ? t('Contact me') : t('Notify me when Plus opens')}
        </button>
        <p className="text-xs leading-relaxed text-muted">
          {t('We only use your email for this. We never sell it, and Stubborn never asks for card details on this page.')}
        </p>
      </form>
    </section>
  )
}
