import { useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'

// Planned pricing. Payments are not switched on: this page shows the model,
// and every feature stays unlocked during the hackathon.

const PLAN_KEY = 'stubborn.planInterest'

interface Plan {
  id: 'free' | 'plus' | 'partners'
  name: string
  price: string
  per: string
  pitch: string
  features: string[]
  cta: string
  highlight?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    per: 'forever',
    pitch: 'Your own record of your hours should never cost money.',
    features: [
      'Unlimited clock in and clock out',
      'Tamper-evident log with a nightly locked seal',
      'Works without signal',
      '2 pay stub checks a month',
      'Hours vs pay stubs history',
      'A ready-made note to your manager',
      'English and Spanish',
    ],
    cta: 'Start free',
  },
  {
    id: 'plus',
    name: 'Plus',
    price: '$3',
    per: 'a month',
    pitch: 'For when something is off and you want backup.',
    features: [
      'Everything in Free',
      'Unlimited pay stub checks',
      'Notes and claim summaries written for you by AI, in English or Spanish',
      'Evidence packets with a QR code anyone can verify',
      'A web agent that fills in the wage claim form for you',
      'Cancel any time. Your log stays yours either way.',
    ],
    cta: 'Tell me when Plus opens',
    highlight: true,
  },
  {
    id: 'partners',
    name: 'Partners',
    price: 'Custom',
    per: 'per organization',
    pitch: 'For unions, worker centers and legal aid clinics.',
    features: [
      'Plus for every member, paid by the organization',
      'A dashboard of open pay gaps across members, shared only with consent',
      'Evidence packets ready for intake and case files',
      'Rule packs for more states',
      'Onboarding and support',
    ],
    cta: 'Talk to us',
  },
]

const WHY = [
  ['Workers never pay to keep their own records.', 'The log, the seal and basic checks are free for good.'],
  ['The paid parts are the ones that cost us money to run.', 'Reading photos, AI writing and the web agent are billed to us per use, so Plus covers them.'],
  ['Organizations can pay so workers do not have to.', 'A union or clinic buys seats, and its members get Plus at no cost.'],
  ['It runs on pay-per-use cloud services.', 'No servers sit idle. Costs rise only when people use it, so it can grow from one worker to many.'],
]

export default function Pricing() {
  const [interest, setInterest] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PLAN_KEY)
    } catch {
      return null
    }
  })

  const choose = (id: string) => {
    setInterest(id)
    try {
      localStorage.setItem(PLAN_KEY, id)
    } catch {
      // the choice just will not be remembered
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="tag text-muted">{t('Pricing')}</p>
        <h1 className="mt-1 text-4xl font-extrabold">{t('Free to keep your record. Small price for backup.')}</h1>
        <p className="mt-2 text-muted">{t('The basics are free for every worker, for good. Plus pays for the parts that cost money to run.')}</p>
      </div>

      <p className="rounded-xl border-2 border-dashed border-ink bg-hi-soft px-4 py-3 text-sm font-semibold">
        {t('Preview of planned pricing. Payments are not switched on, and everything is unlocked during sunhacks 2026.')}
      </p>

      <ul className="grid gap-5">
        {PLANS.map((plan) => (
          <li key={plan.id} className={`card grid gap-4 ${plan.highlight ? 'bg-hi-soft' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold">{t(plan.name)}</h2>
                <p className="mt-0.5 text-sm text-muted">{t(plan.pitch)}</p>
              </div>
              {plan.highlight && <span className="stamp shrink-0 border-ink text-ink">{t('Most help')}</span>}
            </div>
            <p className="leading-none">
              <span className="hl font-display text-5xl font-extrabold">{t(plan.price)}</span>{' '}
              <span className="text-sm font-semibold text-muted">{t(plan.per)}</span>
            </p>
            <ul className="grid gap-2 text-[0.95rem]">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <svg viewBox="0 0 24 24" className="mt-1 h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  <span>{t(feature)}</span>
                </li>
              ))}
            </ul>
            {plan.id === 'free' ? (
              <Link to="/log" className="btn btn-secondary">
                {t(plan.cta)}
              </Link>
            ) : interest === plan.id ? (
              <p role="status" className="rounded-xl border-2 border-accent bg-accent-soft px-4 py-3 text-sm font-semibold text-accent-dark">
                {t('Noted on this phone. Nothing was charged and no account was made.')}
              </p>
            ) : (
              <button type="button" className={`btn ${plan.highlight ? 'btn-primary' : 'btn-secondary'}`} onClick={() => choose(plan.id)}>
                {t(plan.cta)}
              </button>
            )}
          </li>
        ))}
      </ul>

      <section>
        <p className="tag text-muted">{t('Why it is priced this way')}</p>
        <h2 className="mt-1 text-3xl font-extrabold">{t('Built to grow without charging the people it helps')}</h2>
        <ul className="mt-4 grid gap-2">
          {WHY.map(([head, body]) => (
            <li key={head} className="rounded-xl border-2 border-ink/20 bg-card/70 px-4 py-3 text-[0.95rem] leading-snug">
              <b>{t(head)}</b> {t(body)}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs leading-relaxed text-muted">
        {t('Stubborn never takes a cut of wages you recover, and it does not sell your data.')}
      </p>
    </div>
  )
}
