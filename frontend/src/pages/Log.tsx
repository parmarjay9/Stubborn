import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ChainBadge from '../components/ChainBadge'
import ClockButton from '../components/ClockButton'
import ShiftList from '../components/ShiftList'
import StepTrail from '../components/StepTrail'
import { api, type VerifyResult } from '../lib/api'
import { loadLog } from '../lib/offline'
import { getDeviceId, isDemo } from '../lib/device'
import type { Entry } from '../lib/hashchain'
import { t } from '../lib/i18n'

export default function Log() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [verify, setVerify] = useState<VerifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)
  const [pending, setPending] = useState(0)
  const [offline, setOffline] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const deviceId = getDeviceId()
    try {
      const log = await loadLog(deviceId)
      setEntries(log.entries)
      setPending(log.pending)
      setOffline(log.offline)
      setConflict(log.conflict)
      setVerify(log.offline ? null : await api.verify(deviceId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not load your hours.'))
    }
  }, [])

  useEffect(() => {
    refresh()
    // Send saved taps as soon as the phone gets signal back.
    window.addEventListener('online', refresh)
    return () => window.removeEventListener('online', refresh)
  }, [refresh])

  const tampered = verify ? !verify.valid : false

  async function toggleTamper() {
    setToggling(true)
    try {
      await api.demo(getDeviceId(), tampered ? 'restore' : 'tamper')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('The demo switch did not work.'))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <StepTrail current={1} />
        <h1 className="mt-3 text-4xl font-extrabold">{t('My hours')}</h1>
        <p className="mt-1 text-muted">{t('Your timeclock, not theirs. One tap in, one tap out.')}</p>
      </div>

      {error && (
        <div className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
          {error}{' '}
          <button type="button" onClick={refresh} className="font-semibold underline">
            {t('Try again')}
          </button>
        </div>
      )}

      {entries ? <ClockButton entries={entries} onChange={refresh} /> : !error && <div className="skeleton mx-auto h-44 w-44 !rounded-full" />}

      {(offline || pending > 0) && (
        <div role="status" className="rounded-xl border-2 border-dashed border-ink bg-hi-soft px-4 py-3 text-sm">
          <p className="font-bold">{offline ? t('No signal right now') : t('Sending saved taps...')}</p>
          <p className="mt-0.5 text-muted">
            {pending > 0
              ? `${pending === 1 ? t('1 tap is saved on this phone with the time you tapped.') : t('{n} taps are saved on this phone with the time you tapped.', { n: pending })} ${offline ? t('They will send by themselves when you are back online.') : ''}`
              : t('You can still clock in and out. Taps are saved on this phone until you are back online.')}
          </p>
        </div>
      )}
      {conflict && (
        <p className="rounded-xl border-2 border-bad bg-bad-soft px-4 py-3 text-sm text-bad">
          {t('A saved tap could not be sent:')} {conflict}
        </p>
      )}

      {offline ? (
        <div className="rounded-xl border-2 border-ink/30 bg-card px-4 py-3 text-sm text-muted">
          {t('The log seal is checked by the server. It will be checked again when you are back online.')}
        </div>
      ) : (
        <ChainBadge result={verify} failed={Boolean(error) && !verify} />
      )}

      {entries ? <ShiftList entries={entries} /> : !error && <div className="skeleton h-64 !rounded-3xl" />}

      {entries && entries.length > 0 && (
        <Link to="/check" className="btn btn-secondary">
          {t('Check my pay stub')}
        </Link>
      )}

      {/* Stage demo only: shown in the sample account when the address has ?tamper=1 */}
      {isDemo() && new URLSearchParams(location.search).has('tamper') && (
        <label className="flex items-center justify-between gap-4 rounded-xl border-2 border-dashed border-warn bg-warn-soft px-4 py-3 text-sm">
          <span>
            <span className="block font-bold text-warn">{t('Try it: secretly change a saved clock-out time')}</span>
            <span className="mt-0.5 block text-muted">
              {t('This pretends someone went into the records and added an hour to an old shift. Watch the badge above catch it. Switch it off to undo.')}
            </span>
          </span>
          <input type="checkbox" aria-label={t('Change a saved clock-out time')} className="h-7 w-7 shrink-0 accent-[var(--color-bad)]" checked={tampered} disabled={toggling} onChange={toggleTamper} />
        </label>
      )}

      <p className="text-xs leading-relaxed text-muted">
        {t('Your log shows it was never changed after the fact. It cannot prove you were at work, but the time and place on each tap make it hard to fake.')}
      </p>
    </div>
  )
}
