import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Usage } from '../lib/api'
import { getDeviceId } from '../lib/device'
import { t } from '../lib/i18n'

/** Free plan meter: pay stub checks used this month. Shows the limit, never blocks during the hackathon. */
export default function UsageMeter() {
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    let live = true
    api
      .usage(getDeviceId())
      .then((u) => live && setUsage(u))
      .catch(() => {}) // the meter is extra; the page works without it
    return () => {
      live = false
    }
  }, [])

  if (!usage) return null
  const { checksUsed: used, freeChecks: free } = usage
  const out = used >= free

  return (
    <section className={`rounded-xl border-2 px-4 py-3 ${out ? 'border-ink bg-hi-soft' : 'border-ink/25 bg-card/70'}`} aria-label={t('Free plan usage')}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">
          {t('Free plan')}: {used > free ? t('{used} checks this month, {free} included', { used, free }) : t('{used} of {free} pay stub checks used this month', { used, free })}
        </p>
        <div className="flex shrink-0 gap-1" aria-hidden="true">
          {Array.from({ length: free }, (_, i) => (
            <span key={i} className={`h-3 w-6 rounded-sm border-2 border-ink ${i < used ? 'bg-ink' : 'bg-white'}`} />
          ))}
        </div>
      </div>
      {out && (
        <p className="mt-2 text-sm leading-snug">
          {t('You have used this month’s free checks. Plus gives you unlimited checks for $3 a month.')}{' '}
          <Link to="/pricing" className="font-bold underline decoration-hi decoration-4 underline-offset-2">
            {t('See Plus')}
          </Link>
          <span className="mt-1 block text-xs text-muted">{t('During sunhacks 2026 every check stays free, so you can keep going.')}</span>
        </p>
      )}
    </section>
  )
}
