import { Link } from 'react-router-dom'
import Breakdown from '../components/Breakdown'
import OwedCard from '../components/OwedCard'
import { store } from '../lib/store'

export default function Result() {
  const check = store.getCheck()

  if (!check) {
    return (
      <div className="grid gap-5">
        <h1 className="text-3xl font-black tracking-tight">Your result</h1>
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
      <h1 className="text-3xl font-black tracking-tight">Your result</h1>

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

      <Link to="/check" className="text-center text-sm font-semibold text-muted underline">
        Check another pay stub
      </Link>
    </div>
  )
}
