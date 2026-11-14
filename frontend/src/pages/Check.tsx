import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmFields from '../components/ConfirmFields'
import StepTrail from '../components/StepTrail'
import StubUpload, { prepareImage } from '../components/StubUpload'
import { api, uploadStub, type StubFieldName, type StubFields } from '../lib/api'
import { getDeviceId } from '../lib/device'
import { store } from '../lib/store'

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
      setNotice(result.ok ? 'We read these from your stub. Fix anything that looks off.' : result.message ?? null)
      setStage('confirm')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not read that photo.')
      setStage('upload')
    }
  }

  async function confirm(values: StubFields) {
    setChecking(true)
    setError(null)
    try {
      store.setCheck(await api.check(getDeviceId(), values))
      navigate('/result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The check did not run. Please try again.')
      setChecking(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div>
        <StepTrail current={2} />
        <h1 className="mt-3 text-4xl font-extrabold">Check my pay stub</h1>
        <p className="mt-1 text-muted">
          {stage === 'confirm' ? 'Almost there. Confirm the numbers we read.' : 'Snap a photo. We will line it up against your log.'}
        </p>
      </div>

      {stage === 'upload' && (
        <>
          {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
          <StubUpload
            onPick={read}
            onManual={() => {
              setFields(EMPTY)
              setConfidence({})
              setNotice('Type the numbers from your pay stub.')
              setStage('confirm')
            }}
          />
        </>
      )}

      {stage === 'reading' && (
        <div className="grid gap-3" role="status" aria-label="Reading your pay stub">
          <p className="font-semibold">Reading your pay stub...</p>
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
            Use a different photo
          </button>
        </>
      )}
    </div>
  )
}
