import { useEffect, useState } from 'react'
import { ApiError, api } from '../lib/api'
import { getDeviceId } from '../lib/device'
import { clockTime, localIso } from '../lib/format'
import { ZERO_HASH, hashEntry, roundCoord, type Entry, type EntryCore } from '../lib/hashchain'

interface Spot {
  lat: number | null
  lng: number | null
  accuracyM: number | null
}

const NO_SPOT: Spot = { lat: null, lng: null, accuracyM: null }

/** One location reading. Never blocks the clock tap: any failure gives time only. */
function locate(): Promise<Spot> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(NO_SPOT)
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: roundCoord(position.coords.latitude),
          lng: roundCoord(position.coords.longitude),
          accuracyM: Math.round(position.coords.accuracy),
        }),
      () => resolve(NO_SPOT),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    )
  })
}

export default function ClockButton({ entries, onChange }: { entries: Entry[]; onChange: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const head = entries.length ? entries[entries.length - 1] : null
  const clockedIn = head?.type === 'IN'

  async function tap() {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const spot = await locate()
      const core: EntryCore = {
        deviceId: getDeviceId(),
        seq: entries.length,
        type: clockedIn ? 'OUT' : 'IN',
        clientTs: localIso(new Date()),
        ...spot,
        prevHash: head ? head.hash : ZERO_HASH,
      }
      await api.appendShift({ ...core, hash: await hashEntry(core) })
      setNote(
        `${core.type === 'IN' ? 'Clocked in' : 'Clocked out'} at ${clockTime(core.clientTs)}. ` +
          (spot.lat === null ? 'Location was not available, so this entry has the time only.' : 'Time and location saved.'),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not save. Please try again.')
    } finally {
      await onChange()
      setBusy(false)
    }
  }

  return (
    <div className="text-center">
      <p className="mb-4 inline-block rounded-md border-2 border-ink bg-ink px-3 py-1 font-mono text-xl font-bold tabular-nums text-hi" aria-hidden="true">
        {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
      </p>
      <br />
      <button
        type="button"
        onClick={tap}
        disabled={busy}
        className={`mx-auto grid h-44 w-44 place-items-center rounded-full border-[3px] border-ink font-display text-3xl font-extrabold shadow-[6px_6px_0_var(--color-ink)] transition-[transform,box-shadow] duration-100 active:translate-x-[5px] active:translate-y-[5px] active:shadow-none disabled:opacity-70 ${
          clockedIn ? 'bg-ink text-hi shadow-[6px_6px_0_var(--color-hi)]' : 'bg-hi text-ink'
        }`}
      >
        {busy ? 'Punching...' : clockedIn ? 'Clock out' : 'Clock in'}
      </button>
      <p className="mt-5 text-sm font-semibold text-muted" aria-live="polite">
        {clockedIn && head ? `On the clock since ${clockTime(head.clientTs)}` : 'You are off the clock. Tap when your shift starts.'}
      </p>
      {note && <p className="pop mt-2 rounded-xl border-2 border-accent bg-accent-soft px-3 py-2 text-sm text-accent-dark">{note}</p>}
      {error && <p className="pop mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
    </div>
  )
}
