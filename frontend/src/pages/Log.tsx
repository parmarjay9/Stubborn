import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ChainBadge from '../components/ChainBadge'
import ClockButton from '../components/ClockButton'
import ShiftList from '../components/ShiftList'
import { api, type VerifyResult } from '../lib/api'
import { getDeviceId, isDemo } from '../lib/device'
import type { Entry } from '../lib/hashchain'

export default function Log() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [verify, setVerify] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)

  const refresh = useCallback(async () => {
    const deviceId = getDeviceId()
    try {
      const [list, check] = await Promise.all([api.listShifts(deviceId), api.verify(deviceId)])
      setEntries(list.entries)
      setVerify(check)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your hours.')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const tampered = verify ? !verify.valid : false

  async function toggleTamper() {
    setToggling(true)
    try {
      await api.demo(getDeviceId(), tampered ? 'restore' : 'tamper')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The demo switch did not work.')
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-black tracking-tight">My hours</h1>
        <p className="mt-1 text-muted">Your own record. One tap in, one tap out.</p>
      </div>

      {error && (
        <div className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}{' '}
          <button type="button" onClick={refresh} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {entries ? <ClockButton entries={entries} onChange={refresh} /> : !error && <div className="skeleton mx-auto h-44 w-44 !rounded-full" />}

      <ChainBadge result={verify} failed={Boolean(error) && !verify} />

      {entries ? <ShiftList entries={entries} /> : !error && <div className="skeleton h-64 !rounded-3xl" />}

      {entries && entries.length > 0 && (
        <Link to="/check" className="btn btn-secondary">
          Check my pay stub
        </Link>
      )}

      {isDemo() && (
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-warn/50 bg-warn-soft/50 px-4 py-3 text-sm">
          <span>
            <span className="font-semibold text-warn">Demo only:</span> edit one saved entry behind the log's back
          </span>
          <input type="checkbox" className="h-6 w-6 accent-[var(--color-bad)]" checked={tampered} disabled={toggling} onChange={toggleTamper} />
        </label>
      )}

      <p className="text-xs leading-relaxed text-muted">
        The chain shows the log was not edited after the fact. It does not prove you were working. Server receipt times
        and location stamps make it harder to fake. Automatic clock-in by location needs a native app and is planned
        for later.
      </p>
    </div>
  )
}
