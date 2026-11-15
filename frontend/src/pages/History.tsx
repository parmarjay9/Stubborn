import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PaydayReminder from '../components/PaydayReminder'
import { api, type HistoryPeriod, type HistoryResult } from '../lib/api'
import { getDeviceId, isDemo, markSampleSeeded } from '../lib/device'
import { hoursText, money, shortDate } from '../lib/format'
import { store } from '../lib/store'

/** Two bars on one scale: what the worker logged against what the stub paid. */
function Bars({ logged, paid }: { logged: string; paid: string | null }) {
  // Bar lengths are for the eye only. The numbers beside them come from the server.
  const scale = Math.max(Number(logged), Number(paid ?? 0), 1)
  const width = (hours: string) => `${Math.max(4, (Number(hours) / scale) * 100)}%`
  return (
    <div className="grid gap-1.5 font-mono text-sm">
      <div className="flex items-center gap-2">
        <span className="tag w-[5.5rem] shrink-0 whitespace-nowrap text-muted">Your log</span>
        <span className="h-4 rounded-sm border-2 border-ink bg-ink" style={{ width: width(logged) }} />
        <b className="shrink-0">{hoursText(logged)} h</b>
      </div>
      <div className="flex items-center gap-2">
        <span className="tag w-[5.5rem] shrink-0 whitespace-nowrap text-muted">Stub paid</span>
        {paid === null ? (
          <span className="text-muted">no stub checked yet</span>
        ) : (
          <>
            <span className="h-4 rounded-sm border-2 border-ink bg-hi" style={{ width: width(paid) }} />
            <b className="shrink-0">{hoursText(paid)} h</b>
          </>
        )}
      </div>
    </div>
  )
}

function PeriodCard({ period }: { period: HistoryPeriod }) {
  const navigate = useNavigate()
  const check = period.check
  const owes = check !== null && check.totals.owed !== '0.00'

  const open = () => {
    if (!check) return
    store.setCheck(check)
    navigate('/result')
  }

  return (
    <li className="card grid gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tag text-muted">Pay period</p>
          <h3 className="text-lg font-extrabold leading-tight">
            {shortDate(period.start)} to {shortDate(period.end)}
          </h3>
        </div>
        {check === null ? (
          <span className="stamp shrink-0 border-ink/50 text-muted">Not checked</span>
        ) : owes ? (
          <span className="stamp shrink-0 border-bad text-bad">Worth asking</span>
        ) : (
          <span className="stamp shrink-0 border-accent text-accent">Matched</span>
        )}
      </div>

      <Bars logged={period.loggedHours} paid={check ? check.totals.paidHours : null} />

      {check === null ? (
        <Link to="/check" className="btn btn-primary !min-h-12 !text-base">
          Check this pay stub
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/20 pt-3">
          <p className="text-sm">
            {owes ? (
              <>
                <span className="hl font-display text-xl font-extrabold">{money(check.totals.owed)}</span>{' '}
                <span className="font-semibold">possibly owed</span>
              </>
            ) : (
              <span className="font-semibold text-accent-dark">Paid in full for your logged hours</span>
            )}
          </p>
          <button type="button" onClick={open} className="min-h-11 shrink-0 font-bold underline decoration-hi decoration-4 underline-offset-4">
            See details
          </button>
        </div>
      )}
    </li>
  )
}

export default function History() {
  const [data, setData] = useState<HistoryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api.history(getDeviceId()))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your history.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function resetSample() {
    setResetting(true)
    try {
      await api.demo(getDeviceId(), 'seed')
      markSampleSeeded()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The reset did not work.')
    } finally {
      setResetting(false)
    }
  }

  const summary = data?.summary

  return (
    <div className="grid gap-5">
      <div>
        <p className="tag text-muted">Your record, week by week</p>
        <h1 className="mt-1 text-4xl font-extrabold">Hours vs pay stubs</h1>
        <p className="mt-1 text-muted">Every pay period you have checked, lined up against your own log.</p>
      </div>

      {error && (
        <div className="rounded-xl border-2 border-bad bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}{' '}
          <button type="button" onClick={load} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {!data && !error && (
        <div className="grid gap-4" aria-label="Loading your history">
          <div className="skeleton h-28 !rounded-2xl" />
          <div className="skeleton h-40 !rounded-2xl" />
          <div className="skeleton h-40 !rounded-2xl" />
        </div>
      )}

      {data && summary && data.periods.length > 0 && (
        <section className="receipt-wrap">
          <div className="receipt px-5 pb-5 pt-4 text-sm">
            <p className="tag text-muted">Running total</p>
            <p className="leader mt-2"><span>Stubs checked</span><b>{summary.periodsChecked}</b></p>
            <p className="leader"><span>With a gap</span><b>{summary.periodsWithGap}</b></p>
            <p className="leader"><span>Weeks not checked</span><b>{summary.periodsNotChecked}</b></p>
            <p className="mt-3 border-t-2 border-dashed border-ink/40 pt-3 text-center font-display text-4xl font-extrabold">
              <span className="hl">{money(summary.totalOwed)}</span>
            </p>
            <p className="mt-1 pb-2 text-center font-sans text-sm font-bold">possibly owed across checked stubs</p>
          </div>
        </section>
      )}

      {data && data.periods.length === 0 && (
        <div className="card grid gap-3 text-center">
          <p className="font-display text-xl font-extrabold">Nothing to compare yet</p>
          <p className="text-sm text-muted">
            Clock in for a few shifts, then check a pay stub. Each pay period will show up here with your hours next to
            what the stub paid.
          </p>
          <Link to="/log" className="btn btn-primary">
            Clock in
          </Link>
        </div>
      )}

      {data && data.periods.length > 0 && (
        <ul className="grid gap-5">
          {data.periods.map((period) => (
            <PeriodCard key={`${period.start}/${period.end}`} period={period} />
          ))}
        </ul>
      )}

      <PaydayReminder />

      {isDemo() && (
        <button type="button" className="min-h-12 text-sm font-semibold text-muted underline" disabled={resetting} onClick={resetSample}>
          {resetting ? 'Resetting...' : 'Reset the sample account to its starting point'}
        </button>
      )}
    </div>
  )
}
