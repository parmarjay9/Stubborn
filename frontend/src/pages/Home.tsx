import { Link } from 'react-router-dom'

const STEPS = [
  { title: 'Record', text: 'Tap to clock in and out. Each tap is time stamped, location stamped and locked into a chain that cannot be edited later.' },
  { title: 'Catch', text: 'On payday, snap your pay stub. Stubborn compares it to your own log and shows what may be missing, line by line.' },
  { title: 'Act', text: 'Get a polite note for your manager and a wage claim form filled in for you. You review it. Nothing is sent without you.' },
]

export default function Home() {
  return (
    <div className="pop">
      <p className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-dark">
        A sunhacks 2026 project
      </p>
      <h1 className="mt-4 text-[2.6rem] font-black leading-[1.05] tracking-tight">
        Your hours.
        <br />
        Your proof.
        <br />
        <span className="text-accent">Your pay.</span>
      </h1>
      <p className="mt-4 text-lg text-muted">
        Keep your own record of the hours you work, then check your pay stub against it in one photo.
      </p>

      <div className="mt-7 grid gap-3">
        <Link to="/log" className="btn btn-primary">
          Clock in
        </Link>
        <Link to="/check" className="btn btn-secondary">
          Check my pay stub
        </Link>
      </div>

      <ol className="mt-9 grid gap-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="card flex gap-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-dark">
              {index + 1}
            </span>
            <div>
              <h2 className="font-bold">{step.title}</h2>
              <p className="mt-0.5 text-[0.95rem] leading-snug text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        Built for hourly, non-tipped workers in Arizona with one hourly rate and one employer. It checks federal
        overtime (over 40 hours in a workweek) and the Arizona minimum wage. Tips, salaries, break rules and other
        states are not covered yet.
      </p>
    </div>
  )
}
