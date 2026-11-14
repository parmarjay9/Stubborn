import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ChainDemo from '../components/ChainDemo'
import { api } from '../lib/api'
import { SAMPLE_WORKER, getDeviceId, isDemo, setDemo } from '../lib/device'
import { money } from '../lib/format'
import { store } from '../lib/store'

/* ---------- little pictures for the walkthrough (examples, not live data) ---------- */

const PunchVignette = ({ out }: { out?: boolean }) => (
  <div className="flex items-center gap-3">
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-ink text-[0.6rem] font-black uppercase leading-tight shadow-hard-sm ${out ? 'bg-ink text-hi' : 'bg-hi'}`}>
      {out ? 'Out' : 'In'}
    </span>
    <span className="font-mono text-xs leading-relaxed">
      <b>{out ? '5:02 PM' : '8:02 AM'}</b> Mon Nov 9
      <br />
      <span className="text-muted">{out ? 'locked to the entry before it' : 'time + location stamped'}</span>
    </span>
  </div>
)

const SnapVignette = () => (
  <div className="relative mx-auto w-40 overflow-hidden rounded border-2 border-ink bg-white p-2 font-mono text-[0.6rem] leading-relaxed">
    <p className="font-bold">EARNINGS STATEMENT</p>
    <p>Regular hours ..... 38.00</p>
    <p>Rate ............. $17.00</p>
    <p>Gross pay ....... $646.00</p>
    <span className="scan absolute inset-x-0 h-0.5 bg-bad shadow-[0_0_8px_2px_rgb(180_35_24/0.5)]" aria-hidden="true" />
  </div>
)

const ConfirmVignette = () => (
  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
    <span className="rounded border-2 border-ink/70 bg-white px-2 py-1">
      <span className="block text-[0.6rem] text-muted">Rate</span>17.00
    </span>
    <span className="rounded border-2 border-warn bg-warn-soft px-2 py-1">
      <span className="block text-[0.6rem] font-bold text-warn">Please check</span>38.00
    </span>
  </div>
)

const OwedVignette = () => (
  <div className="font-mono text-xs">
    <p className="leader"><span>Your log</span><b>43.5 h</b></p>
    <p className="leader"><span>Stub paid</span><b>38 h</b></p>
    <p className="mt-1 font-display text-2xl font-extrabold">
      <span className="hl">$123.25</span> <span className="font-sans text-xs font-semibold text-muted">possibly owed</span>
    </p>
  </div>
)

const ActVignette = () => (
  <ul className="grid gap-1.5 text-xs font-semibold">
    {['Note to your manager, drafted', 'Claim form, filled in', 'Stopped before submit'].map((line) => (
      <li key={line} className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {line}
      </li>
    ))}
  </ul>
)

/* ---------- the process ---------- */

interface Step {
  title: string
  you: string
  we: string
  time: string
  picture: ReactNode
}

const PHASES: { name: string; when: string; to: string; cta: string; steps: Step[] }[] = [
  {
    name: 'Record',
    when: 'Every shift',
    to: '/log',
    cta: 'Open my hours',
    steps: [
      {
        title: 'Tap in when you start',
        you: 'Hit the big Clock in button when your shift begins.',
        we: 'We stamp the time and your location, and send a copy to the server.',
        time: '2 seconds',
        picture: <PunchVignette />,
      },
      {
        title: 'Tap out when you leave',
        you: 'Hit Clock out. That is the whole job.',
        we: 'Each entry is fingerprinted and chained to the one before, so nobody can quietly edit it later. Not your boss, not you, not us.',
        time: '2 seconds',
        picture: <PunchVignette out />,
      },
    ],
  },
  {
    name: 'Catch',
    when: 'On payday',
    to: '/check',
    cta: 'Check a pay stub',
    steps: [
      {
        title: 'Snap your pay stub',
        you: 'Take one photo of the stub, flat and in good light.',
        we: 'We read the hours, the rate, the gross pay and the pay period off the page.',
        time: '10 seconds',
        picture: <SnapVignette />,
      },
      {
        title: 'Confirm the numbers',
        you: 'Glance over what we read and fix anything that looks off.',
        we: 'Anything we are unsure about is marked in amber. You have the final say.',
        time: '20 seconds',
        picture: <ConfirmVignette />,
      },
      {
        title: 'See what may be missing',
        you: 'Read the result. Tap any line to see the math.',
        we: 'We line your log up against the stub, apply overtime and minimum wage, and show the gap to the cent.',
        time: 'Instant',
        picture: <OwedVignette />,
      },
    ],
  },
  {
    name: 'Act',
    when: 'If something is off',
    to: '/act',
    cta: 'See my options',
    steps: [
      {
        title: 'Ask about it, your way',
        you: 'Send the friendly note, or review the claim form. Or do nothing. Your call.',
        we: 'We draft a polite note to your manager and fill in a wage claim form. We never press submit.',
        time: '1 minute',
        picture: <ActVignette />,
      },
    ],
  },
]

/* ---------- "you are here" ---------- */

function useProgress() {
  const [hasHours, setHasHours] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    api
      .listShifts(getDeviceId())
      .then((result) => live && setHasHours(result.entries.length > 0))
      .catch(() => live && setHasHours(false))
    return () => {
      live = false
    }
  }, [])
  const check = store.getCheck()
  return { hasHours, check, acted: store.getLetters() !== null }
}

function NextStep() {
  const { hasHours, check, acted } = useProgress()
  if (hasHours === null) return <div className="skeleton h-28 !rounded-2xl" />

  const owed = check && check.totals.owed !== '0.00' ? money(check.totals.owed) : null
  const next = !hasHours
    ? { line: 'Start your own timesheet. It takes one tap.', to: '/log', cta: 'Clock in' }
    : !check
      ? { line: 'Your hours are on the record. Got a pay stub? Check it against your log.', to: '/check', cta: 'Check my pay stub' }
      : owed && !acted
        ? { line: `Your last check found ${owed} possibly owed. Worth asking about.`, to: '/act', cta: 'Take action' }
        : { line: 'You are all caught up. Keep clocking in.', to: '/log', cta: 'Open my hours' }

  const done = [Boolean(hasHours), Boolean(check), acted]
  return (
    <section className="card grid gap-3" aria-label="Your next step">
      <div className="flex items-center justify-between">
        <p className="tag text-muted">You are here</p>
        <ol className="flex gap-1.5">
          {['Record', 'Catch', 'Act'].map((name, index) => (
            <li key={name} className={`tag rounded border-2 px-1.5 py-0.5 ${done[index] ? 'border-accent bg-accent-soft text-accent-dark' : 'border-ink/25 text-muted'}`}>
              {done[index] ? '✓ ' : ''}
              {name}
            </li>
          ))}
        </ol>
      </div>
      <p className="font-display text-lg font-bold leading-snug">{next.line}</p>
      <Link to={next.to} className="btn btn-primary">
        {next.cta}
      </Link>
    </section>
  )
}

/* ---------- page ---------- */

const UNDER_THE_HOOD = [
  ['Amazon Textract', 'reads the numbers off your stub photo.'],
  ['A tested rules engine', 'does all the math with exact decimals. No AI touches the money.'],
  ['Claude on Amazon Bedrock', 'only writes the words, and every dollar amount is checked against the engine.'],
  ['A TinyFish web agent', 'fills in the claim form and stops before submit.'],
]

export default function Home() {
  return (
    <div className="pop grid gap-10">
      <section>
        <p className="tag text-muted">A sunhacks 2026 project</p>
        <h1 className="mt-3 text-[3.1rem] font-extrabold leading-[0.98]">
          Your hours.
          <br />
          Your proof.
          <br />
          <span className="hl">Your pay.</span>
        </h1>
        <p className="mt-5 text-lg leading-snug text-muted">
          Your employer keeps the timeclock. <b className="text-ink">Now you keep one too.</b> Stubborn checks your pay stub against
          your own record and helps you ask about anything missing. Politely. Persistently.
        </p>

        {/* an example of the payoff, tilted like a stub tossed on a desk */}
        <div className="receipt-wrap mx-auto mt-7 w-64 rotate-2">
          <div className="receipt px-4 pt-3 text-sm">
            <p className="tag text-muted">Example pay check</p>
            <p className="leader mt-2"><span>Your log</span><b>43.5 h</b></p>
            <p className="leader"><span>Stub paid</span><b>38 h</b></p>
            <p className="leader"><span>Missing</span><b>5.5 h</b></p>
            <p className="mt-2 border-t-2 border-dashed border-ink/40 pt-2 text-center font-display text-3xl font-extrabold">
              <span className="hl">$123.25</span>
            </p>
            <p className="pb-3 text-center text-xs">possibly owed</p>
          </div>
        </div>
      </section>

      <NextStep />

      {!isDemo() && (
        <section className="rounded-2xl border-2 border-dashed border-ink bg-hi-soft p-5">
          <p className="tag text-muted">Just looking?</p>
          <h2 className="mt-1 text-2xl font-extrabold">Try the sample account</h2>
          <p className="mt-1.5 text-[0.95rem] leading-snug text-muted">
            Step into the shoes of {SAMPLE_WORKER.name}, a made-up warehouse worker. Four weeks of hours are already
            logged and three pay stubs are already checked, so you can see hours against pay stubs right away.
          </p>
          <button
            type="button"
            className="btn btn-secondary mt-4"
            onClick={() => {
              setDemo(true)
              location.assign('/history')
            }}
          >
            Open the sample account
          </button>
        </section>
      )}

      <section id="how" className="scroll-mt-20">
        <p className="tag text-muted">How it works</p>
        <h2 className="mt-1 text-3xl font-extrabold">Six small steps. Three of them are one tap.</h2>

        <div className="mt-6 grid gap-8">
          {PHASES.map((phase, phaseIndex) => {
            const offset = PHASES.slice(0, phaseIndex).reduce((sum, p) => sum + p.steps.length, 0)
            return (
              <div key={phase.name}>
                <div className="flex items-center gap-3">
                  <span className="rounded-md border-2 border-ink bg-ink px-2.5 py-1 font-display text-lg font-extrabold text-hi">{phase.name}</span>
                  <span className="tag text-muted">{phase.when}</span>
                  <span className="h-0.5 flex-1 bg-ink/20" aria-hidden="true" />
                </div>

                <ol className="mt-4 grid gap-0">
                  {phase.steps.map((step, stepIndex) => (
                    <li key={step.title} className="relative grid grid-cols-[2.5rem_1fr] gap-x-3 pb-6 last:pb-2">
                      {/* the timeline rail */}
                      <span className="absolute bottom-0 left-[1.2rem] top-10 w-0.5 bg-ink/25" aria-hidden="true" />
                      <span className="z-10 grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-hi font-mono text-base font-bold shadow-hard-sm">
                        {offset + stepIndex + 1}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <h3 className="text-xl font-extrabold leading-tight">{step.title}</h3>
                          <span className="tag text-muted">{step.time}</span>
                        </div>
                        <p className="mt-1.5 text-[0.95rem] leading-snug">
                          <span className="tag mr-1.5 text-ink">You</span>
                          {step.you}
                        </p>
                        <p className="mt-1 text-[0.95rem] leading-snug text-muted">
                          <span className="tag mr-1.5 text-accent">Stubborn</span>
                          {step.we}
                        </p>
                        <div className="mt-3 rounded-xl border-2 border-dashed border-ink/30 bg-card/70 p-3">{step.picture}</div>
                      </div>
                    </li>
                  ))}
                </ol>

                <Link to={phase.to} className="ml-[3.25rem] inline-flex min-h-11 items-center gap-1 font-bold underline decoration-hi decoration-4 underline-offset-4">
                  {phase.cta} <span aria-hidden="true">→</span>
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <p className="tag text-muted">Why anyone should believe your log</p>
        <h2 className="mt-1 text-3xl font-extrabold">A timesheet that tattles on edits</h2>
        <p className="mb-5 mt-2 text-muted">
          A note in your phone can be changed any time, so it is easy to wave away. Stubborn's log is different, and you can
          see why right here.
        </p>
        <ChainDemo />
      </section>

      <section>
        <p className="tag text-muted">Under the hood</p>
        <h2 className="mt-1 text-3xl font-extrabold">Who does what</h2>
        <ul className="mt-4 grid gap-2">
          {UNDER_THE_HOOD.map(([who, what]) => (
            <li key={who} className="rounded-xl border-2 border-ink/20 bg-card/70 px-4 py-3 text-[0.95rem] leading-snug">
              <b>{who}</b> {what}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border-2 border-dashed border-ink/40 p-4 text-sm leading-relaxed text-muted">
        <p className="tag text-ink">The fine print, in plain words</p>
        <p className="mt-2">
          Built for hourly, non-tipped workers in Arizona with one hourly rate and one employer. It checks federal overtime
          (over 40 hours in a workweek) and the Arizona minimum wage. Tips, salaries, break rules and other states are not
          covered yet. The log shows it was not edited after the fact. It cannot prove you were working.
        </p>
      </section>
    </div>
  )
}
