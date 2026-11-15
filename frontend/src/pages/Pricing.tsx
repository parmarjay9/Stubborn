import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import WaitlistForm, { joinedPlans, type WaitlistPlan } from '../components/WaitlistForm'
import { t } from '../lib/i18n'

// Planned pricing. Payments are not switched on: this page shows the model,
// and every feature stays unlocked during the hackathon.
// The three plans sit side by side on every screen size, as a comparison table.

type PlanId = 'free' | 'plus' | 'partners'

const PLANS: { id: PlanId; name: string; price: string; per: string; pitch: string }[] = [
  { id: 'free', name: 'Free', price: '$0', per: 'forever', pitch: 'Your own record of your hours should never cost money.' },
  { id: 'plus', name: 'Plus', price: '$3', per: 'a month', pitch: 'For when something is off and you want backup.' },
  { id: 'partners', name: 'Partners', price: 'Custom', per: 'per organization', pitch: 'For unions, worker centers and legal aid clinics.' },
]

// true = included, false = not included, string = included with this limit
type Cell = boolean | string

const ROWS: { feature: string; cells: [Cell, Cell, Cell] }[] = [
  { feature: 'Clock in and out', cells: ['Unlimited', 'Unlimited', 'Unlimited'] },
  { feature: 'An hours log nobody can secretly change', cells: [true, true, true] },
  { feature: 'Works without signal', cells: [true, true, true] },
  { feature: 'Hours vs pay stubs history', cells: [true, true, true] },
  { feature: 'English and Spanish', cells: [true, true, true] },
  { feature: 'Pay stub checks', cells: ['2 a month', 'Unlimited', 'Unlimited'] },
  { feature: 'Note to your manager', cells: ['Template', 'AI-written', 'AI-written'] },
  { feature: 'Evidence packets with a QR code', cells: [false, true, true] },
  { feature: 'Claim form agent', cells: [false, true, true] },
  { feature: 'Dashboard of members’ pay gaps, with consent', cells: [false, false, true] },
  { feature: 'Support for more states', cells: [false, false, true] },
  { feature: 'Onboarding and support', cells: [false, false, true] },
  { feature: 'Who pays', cells: ['Nobody', 'The worker', 'The organization'] },
]

const WHY = [
  ['Keeping your own hours is always free.', 'Clocking in, your hours log and basic pay checks cost nothing, now or later.'],
  ['You only pay for the extras.', 'Reading your stub photo, writing letters for you and filling in forms cost us a little each time. Plus covers that.'],
  ['Groups can pay for their members.', 'A union or worker center can buy Plus for its members, so the workers pay nothing.'],
  ['Our costs only grow when people use it.', 'We do not pay for anything sitting unused, so Stubborn can go from one worker to thousands without raising prices.'],
]

/** Background that marks the Plus column all the way down. */
const colBg = (index: number) => (index === 1 ? 'bg-hi-soft' : '')

function CellView({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={t('Included')}>
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    )
  }
  if (value === false) {
    return (
      <span className="block text-center text-lg leading-none text-ink/30" role="img" aria-label={t('Not included')}>
        –
      </span>
    )
  }
  return <span className="block text-center text-xs font-bold leading-tight sm:text-sm">{t(value)}</span>
}

export default function Pricing() {
  const [open, setOpen] = useState<WaitlistPlan | null>(null)
  const [joined, setJoined] = useState<WaitlistPlan[]>(joinedPlans)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open])

  const choose = (id: WaitlistPlan) => setOpen(id)
  const close = () => {
    setOpen(null)
    setJoined(joinedPlans())
  }

  const cta = (id: PlanId) => {
    const base = 'btn !min-h-11 !rounded-lg !px-1 !text-sm !shadow-hard-sm sm:!text-base'
    if (id === 'free') {
      return (
        <Link to="/log" className={`${base} btn-secondary`}>
          {t('Start free')}
        </Link>
      )
    }
    if (joined.includes(id)) {
      return (
        <p role="status" className="rounded-lg border-2 border-accent bg-accent-soft px-1 py-2 text-center text-xs font-bold text-accent-dark">
          {id === 'plus' ? t('On the list') : t('We will be in touch')}
        </p>
      )
    }
    return (
      <button type="button" className={`${base} ${id === 'plus' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => choose(id)}>
        {id === 'plus' ? t('Notify me') : t('Talk to us')}
      </button>
    )
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

      <section className="card overflow-hidden p-0" aria-label={t('Compare plans')}>
        {/* Plan headers: always three across */}
        <div className="grid grid-cols-3 border-b-2 border-ink">
          {PLANS.map((plan, index) => (
            <div key={plan.id} className={`grid min-w-0 content-between gap-3 px-2 py-4 text-center sm:px-4 ${colBg(index)} ${index > 0 ? 'border-l-2 border-ink/15' : ''}`}>
              <div>
                {plan.id === 'plus' && <p className="tag mb-1 text-[0.6rem] text-ink sm:text-xs">{t('Most help')}</p>}
                <h2 className="hyphens-auto break-words text-lg font-extrabold leading-tight sm:text-2xl">{t(plan.name)}</h2>
                <p className="mt-2 leading-none">
                  <span className={`hl font-display font-extrabold ${plan.price === 'Custom' ? 'text-base min-[360px]:text-xl sm:text-3xl' : 'text-3xl sm:text-5xl'}`}>{t(plan.price)}</span>
                </p>
                <p className="mt-1.5 text-[0.7rem] font-semibold leading-tight text-muted sm:text-sm">{t(plan.per)}</p>
                <p className="mt-2 hidden text-sm leading-snug text-muted sm:block">{t(plan.pitch)}</p>
              </div>
              {cta(plan.id)}
            </div>
          ))}
        </div>

        {/* Feature rows: label across the top, then one cell per plan */}
        <ul>
          {ROWS.map((row, rowIndex) => (
            <li key={row.feature} className={rowIndex > 0 ? 'border-t-2 border-dashed border-ink/15' : ''}>
              <p className="px-3 pt-2.5 text-[0.8rem] font-semibold text-muted sm:px-4 sm:text-sm">{t(row.feature)}</p>
              <div className="grid grid-cols-3">
                {row.cells.map((cell, index) => (
                  <div key={index} className={`flex min-h-10 items-center justify-center px-1 pb-2.5 pt-1.5 ${colBg(index)} ${index > 0 ? 'border-l-2 border-ink/15' : ''}`}>
                    <CellView value={cell} />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div ref={formRef} className="scroll-mt-20 empty:hidden">
        {open && <WaitlistForm key={open} plan={open} onClose={close} />}
      </div>

      <section>
        <p className="tag text-muted">{t('Why it is priced this way')}</p>
        <h2 className="mt-1 text-3xl font-extrabold">{t('Fair to workers, and ready to grow')}</h2>
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
