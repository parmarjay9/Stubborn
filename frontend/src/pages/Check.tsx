import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmFields from '../components/ConfirmFields'
import ImagePopup from '../components/ImagePopup'
import StepTrail from '../components/StepTrail'
import StubUpload, { prepareImage } from '../components/StubUpload'
import UsageMeter from '../components/UsageMeter'
import { api, uploadStub, type StubFieldName, type StubFields } from '../lib/api'
import { SAMPLE_WORKER, getDeviceId, isDemo } from '../lib/device'
import { store } from '../lib/store'
import { t } from '../lib/i18n'

const EMPTY: StubFields = {
  payPeriodStart: '',
  payPeriodEnd: '',
  hourlyRate: '',
  regularHoursPaid: '',
  overtimeHoursPaid: '',
  grossPay: '',
}

type Stage = 'upload' | 'reading' | 'confirm'

export default function Check() {
  const navigate = useNavigate()
  const [stage, setStage] = useState<Stage>('upload')
  const [fields, setFields] = useState<StubFields>(EMPTY)
  const [confidence, setConfidence] = useState<Partial<Record<StubFieldName, number>>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [zoom, setZoom] = useState(false)

  async function read(file: File) {
    setStage('reading')
    setError(null)
    setNotice(null)
    try {
      const deviceId = getDeviceId()
      const image = await prepareImage(file)
      const { key, uploadUrl } = await api.uploadUrl(deviceId, image.type)
      await uploadStub(uploadUrl, image)
      const result = await api.extract(deviceId, key)

      const next = { ...EMPTY }
      const scores: Partial<Record<StubFieldName, number>> = {}
      for (const name of Object.keys(EMPTY) as StubFieldName[]) {
        next[name] = result.fields[name]?.value ?? ''
        scores[name] = result.fields[name]?.value ? result.fields[name].confidence : 0
      }
      // A stub with no overtime line is common: treat a blank as zero but flag it.
      if (result.ok && next.overtimeHoursPaid === '') next.overtimeHoursPaid = '0.00'
      setFields(next)
      setConfidence(result.ok ? scores : {})
      setNotice(result.ok ? t('We read these from your stub. Fix anything that looks off.') : t('We could not read the stub automatically. Please type the numbers in.'))
      setStage('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('We could not read that photo.'))
      setStage('upload')
    }
  }

  /** The sample account has no paper stub to photograph, so it ships with one. */
  async function useSample() {
    try {
      const blob = await (await fetch('/sample-stub.png')).blob()
      await read(new File([blob], 'sample-stub.png', { type: 'image/png' }))
    } catch {
      setError(t('We could not read that photo.'))
    }
  }

  async function confirm(values: StubFields) {
    setChecking(true)
    setError(null)
    try {
      store.setCheck(await api.check(getDeviceId(), values))
      navigate('/result')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('The check did not run. Please try again.'))
      setChecking(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <StepTrail current={2} />
        <h1 className="mt-3 text-4xl font-extrabold">{t('Check my pay stub')}</h1>
        <p className="mt-1 text-muted">
          {stage === 'confirm' ? t('Almost there. Confirm the numbers we read.') : t('Snap a photo. We will line it up against your log.')}
        </p>
      </div>

      {stage === 'upload' && (
        <>
          <UsageMeter />
          {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
          {isDemo() && (
            <section className="rounded-2xl border-2 border-dashed border-ink bg-hi-soft p-4">
              <p className="tag text-muted">{t('Sample account')}</p>
              <h2 className="mt-1 text-xl font-extrabold">{t("{name}'s pay stub for Nov 8 to Nov 14", { name: SAMPLE_WORKER.name })}</h2>
              <div className="mt-3 flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => setZoom(true)}
                  className="group relative w-28 shrink-0 overflow-hidden rounded border-2 border-ink bg-white"
                  aria-label={t('Tap to see it bigger')}
                >
                  <img src="/sample-stub.png" alt={t('Sample pay stub')} className="block w-full" />
                  <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-0.5 text-center text-[0.65rem] font-bold text-hi">
                    {t('Tap to see it bigger')}
                  </span>
                </button>
                <p className="text-sm leading-snug text-muted">
                  {t('This is the stub for the one week that has not been checked yet. Use it to see the whole check, the same as if you had photographed it.')}
                </p>
              </div>
              <button type="button" className="btn btn-primary mt-4" onClick={useSample}>
                {t('Use this sample pay stub')}
              </button>
            </section>
          )}
          {zoom && <ImagePopup src="/sample-stub.png" alt={t('Sample pay stub')} onClose={() => setZoom(false)} />}
          <StubUpload
            onPick={read}
            onManual={() => {
              setFields(EMPTY)
              setConfidence({})
              setNotice(t('Type the numbers from your pay stub.'))
              setStage('confirm')
            }}
          />
        </>
      )}

      {stage === 'reading' && (
        <div className="grid gap-3" role="status" aria-label={t('Reading your pay stub')}>
          <p className="font-semibold">{t('Reading your pay stub...')}</p>
          <div className="card grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="skeleton h-14" />
            ))}
          </div>
        </div>
      )}

      {stage === 'confirm' && (
        <>
          {notice && <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent-dark">{notice}</p>}
          <ConfirmFields initial={fields} confidence={confidence} busy={checking} error={error} onConfirm={confirm} />
          <button type="button" className="min-h-12 text-sm font-semibold text-muted underline" onClick={() => setStage('upload')}>
            {t('Use a different photo')}
          </button>
        </>
      )}
    </div>
  )
}
