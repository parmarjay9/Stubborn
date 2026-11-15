import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { api, type CheckResult, type Worker } from '../lib/api'
import { getDeviceId } from '../lib/device'
import { t } from '../lib/i18n'

/** Makes a read-only link to this pay check and the hour log behind it. */
export default function EvidencePacket({ check, worker }: { check: CheckResult; worker: Worker }) {
  const storeKey = `stubborn.share.${check.checkId}`
  const [shareId, setShareId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storeKey)
    } catch {
      return null
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)
  const url = shareId ? `${location.origin}/v/${shareId}` : ''

  useEffect(() => {
    if (url) QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#17160f', light: '#00000000' } }).then(setQr)
  }, [url])

  async function make() {
    setBusy(true)
    setError(null)
    try {
      const { shareId: id } = await api.share(getDeviceId(), check.checkId, { name: worker.name, employer: worker.employer })
      setShareId(id)
      try {
        localStorage.setItem(storeKey, id)
      } catch {
        // fine: the link just will not be remembered
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('The packet could not be made. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (!shareId) {
    return (
      <div className="grid gap-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={make}>
          {busy ? t('Making your packet...') : t('Make my evidence packet')}
        </button>
        {error && <p className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
        <p className="text-xs text-muted">
          {t('The link shows this pay check, your clock-in and clock-out times and where you clocked in. It cannot be used to change your log or see your other pay checks.')}
        </p>
      </div>
    )
  }

  return (
    <div className="pop grid gap-3">
      <div className="flex items-center gap-4 rounded-xl border-2 border-ink bg-white p-3">
        <div className="aspect-square w-24 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} aria-label={t('QR code for the packet link')} />
        <div className="min-w-0">
          <p className="font-bold">{t('Your packet is ready')}</p>
          <p className="truncate font-mono text-xs text-muted">{url}</p>
          <p className="mt-1 text-xs text-muted">{t('Anyone who scans this can check your log for themselves.')}</p>
        </div>
      </div>
      <a href={`/v/${shareId}`} target="_blank" rel="noreferrer" className="btn btn-primary !min-h-12 !text-base">
        {t('Open packet (save as PDF)')}
      </a>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="btn btn-secondary !min-h-12 !text-base"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url)
              setCopied(true)
            } catch {
              setCopied(false)
            }
          }}
        >
          {copied ? t('Copied') : t('Copy link')}
        </button>
        <button
          type="button"
          className="btn btn-secondary !min-h-12 !text-base"
          disabled={!navigator.share}
          onClick={() => navigator.share?.({ url, title: t('Pay evidence packet') }).catch(() => {})}
        >
          {t('Share')}
        </button>
      </div>
    </div>
  )
}
