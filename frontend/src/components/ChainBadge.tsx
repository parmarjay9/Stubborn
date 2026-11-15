import type { VerifyResult } from '../lib/api'
import { t } from '../lib/i18n'

/** The log's seal: a rubber stamp that thunks down green or red. */
export default function ChainBadge({ result, failed }: { result: VerifyResult | null; failed?: boolean }) {
  if (failed) {
    return <div className="rounded-xl border-2 border-ink/30 bg-card px-4 py-3 text-sm text-muted">{t('Could not check the log right now.')}</div>
  }
  if (!result) return <div className="skeleton h-20" aria-label={t('Checking your log')} />

  if (!result.valid) {
    return (
      <div role="status" className="flex items-center gap-4 rounded-xl border-2 border-bad bg-bad-soft px-4 py-3 text-bad">
        <span key="bad" className="stamp thunk shrink-0 border-bad">
          {t('Changed')}
        </span>
        <div>
          <p className="font-display text-lg font-extrabold leading-tight">{t('Log was changed at entry {n}', { n: result.brokenAtSeq ?? '' })}</p>
          <p className="text-sm">{t('The fingerprints stop matching from that entry on.')}</p>
        </div>
      </div>
    )
  }

  return (
    <div role="status" className="flex items-center gap-4 rounded-xl border-2 border-accent bg-accent-soft px-4 py-3 text-accent-dark">
      <span key="ok" className="stamp thunk shrink-0 border-accent">
        {result.count === 0 ? t('Ready') : t('Verified')}
      </span>
      <div>
        <p className="font-display text-lg font-extrabold leading-tight">
          {result.count === 0 ? t('Log ready') : result.count === 1 ? t('Log verified, 1 entry, untouched') : t('Log verified, {n} entries, untouched', { n: result.count })}
        </p>
        <p className="text-sm">
          {result.count === 0 ? t('Your first clock-in starts the chain.') : t('Every entry is fingerprinted and chained to the one before it.')}
        </p>
      </div>
    </div>
  )
}
