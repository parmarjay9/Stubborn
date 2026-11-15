import { Link } from 'react-router-dom'
import Breakdown from '../components/Breakdown'
import OwedCard from '../components/OwedCard'
import PaydayReminder from '../components/PaydayReminder'
import StepTrail from '../components/StepTrail'
import { store } from '../lib/store'

export default function Result() {
  const check = store.getCheck()

  if (!check) {
    return (
      <div className="grid gap-5">
        <div>
          <StepTrail current={2} />
          <h1 className="mt-3 text-4xl font-extrabold">Your result</h1>
        </div>
        <div className="card text-center">
          <p className="font-semibold">No pay stub checked yet</p>
          <p className="mt-1 text-sm text-muted">Snap a photo of your stub and your result will show up here.</p>
        </div>
        <Link to="/check" className="btn btn-primary">
          Check my pay stub
        </Link>
      </div>
    )
  }

  const owes = check.totals.owed !== '0.00'

  return (
    <div className="grid gap-5">
      <div>
          <StepTrail current={2} />
          <h1 className="mt-3 text-4xl font-extrabold">Your result</h1>
        </div>

      <OwedCard check={check} />

      {!check.log.valid && (
        <p className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
          Heads up: your hour log was changed at entry {check.log.brokenAtSeq}, so it is weaker as a record.
        </p>
      )}
      {check.warnings.map((warning) => (
        <p key={warning} className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">
          {warning}
        </p>
      ))}

      <Breakdown findings={check.findings} />

      {(owes || check.rateBelowMinimum) && (
        <div className="grid gap-3">
          <p className="text-muted">This is worth asking about. Start with a friendly note, or get a claim form ready.</p>
          <Link to="/act?do=letter" className="btn btn-primary">
            Write to my manager
          </Link>
          <Link to="/act?do=claim" className="btn btn-secondary">
            File a wage claim
          </Link>
        </div>
      )}

      <PaydayReminder />

      <div className="flex justify-center gap-6 text-sm font-semibold text-muted">
        <Link to="/history" className="underline">
          See all pay periods
        </Link>
        <Link to="/check" className="underline">
          Check another stub
        </Link>
      </div>
    </div>
  )
}
