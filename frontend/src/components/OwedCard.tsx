import type { CheckResult } from '../lib/api'
import { hoursText, money, shortDate } from '../lib/format'

export default function OwedCard({ check }: { check: CheckResult }) {
  const owes = check.totals.owed !== '0.00'
  return (
    <section className={`pop rounded-3xl px-6 py-8 text-center text-white ${owes ? 'bg-accent' : 'bg-ink'}`}>
      <p className="text-sm font-semibold uppercase tracking-wide text-white/75">
        {shortDate(check.payPeriod.start)} to {shortDate(check.payPeriod.end)}
      </p>
      <p className="mt-2 text-[4rem] font-black leading-none tracking-tight tabular-nums">{money(check.totals.owed)}</p>
      <p className="mt-3 text-lg font-semibold">
        {owes ? 'possibly owed to you this pay period' : 'Nothing looks missing this pay period'}
      </p>
      <p className="mt-4 text-sm text-white/80">
        Your log: {hoursText(check.totals.loggedHours)} hours. Your stub: {hoursText(check.totals.paidHours)} hours paid.
      </p>
    </section>
  )
}
