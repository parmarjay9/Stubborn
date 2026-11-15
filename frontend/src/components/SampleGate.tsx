import { useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { getDeviceId, isDemo, markSampleSeeded, sampleSeeded, setDemo } from '../lib/device'
import { LogoMark } from './Logo'
import { t } from '../lib/i18n'

// One request per page load, even when React runs the effect twice in dev.
let seeding: Promise<void> | null = null
function seedOnce(): Promise<void> {
  seeding ??= api.demo(getDeviceId(), 'seed').then(() => markSampleSeeded())
  return seeding
}

/** The first time a browser opens the sample account, load its history
    (four weeks of hours, three checked pay stubs) before showing any page. */
export default function SampleGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => !isDemo() || sampleSeeded())
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (ready) return
    seedOnce().then(
      () => setReady(true),
      () => setFailed(true),
    )
  }, [ready])

  if (ready) return <>{children}</>

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="grid justify-items-center gap-4">
        <LogoMark className={`h-16 w-16 ${failed ? '' : 'animate-pulse'}`} />
        {failed ? (
          <>
            <p className="font-display text-xl font-extrabold">{t('The sample account did not load')}</p>
            <p className="max-w-xs text-sm text-muted">{t('We could not reach the server. Check your connection and try again.')}</p>
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
              {t('Try again')}
            </button>
            <button
              type="button"
              className="text-sm font-semibold underline"
              onClick={() => {
                setDemo(false)
                location.assign('/')
              }}
            >
              {t('Go back')}
            </button>
          </>
        ) : (
          <p className="font-display text-xl font-extrabold" role="status">
            {t('Setting up the sample account...')}
          </p>
        )}
      </div>
    </div>
  )
}
