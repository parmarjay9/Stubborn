import type { VerifyResult } from '../lib/api'

/** The log's seal: a rubber stamp that thunks down green or red. */
export default function ChainBadge({ result, failed }: { result: VerifyResult | null; failed?: boolean }) {
  if (failed) {
    return <div className="rounded-xl border-2 border-ink/30 bg-card px-4 py-3 text-sm text-muted">Could not check the log right now.</div>
  }
  if (!result) return <div className="skeleton h-20" aria-label="Checking your log" />

  if (!result.valid) {
    return (
      <div role="status" className="flex items-center gap-4 rounded-xl border-2 border-bad bg-bad-soft px-4 py-3 text-bad">
        <span key="bad" className="stamp thunk shrink-0 border-bad">
          Changed
        </span>
        <div>
          <p className="font-display text-lg font-extrabold leading-tight">Log was changed at entry {result.brokenAtSeq}</p>
          <p className="text-sm">The fingerprints stop matching from that entry on.</p>
        </div>
      </div>
    )
  }

  return (
    <div role="status" className="flex items-center gap-4 rounded-xl border-2 border-accent bg-accent-soft px-4 py-3 text-accent-dark">
      <span key="ok" className="stamp thunk shrink-0 border-accent">
        {result.count === 0 ? 'Ready' : 'Verified'}
      </span>
      <div>
        <p className="font-display text-lg font-extrabold leading-tight">
          {result.count === 0 ? 'Log ready' : `Log verified, ${result.count} ${result.count === 1 ? 'entry' : 'entries'}, untouched`}
        </p>
        <p className="text-sm">
          {result.count === 0 ? 'Your first clock-in starts the chain.' : 'Every entry is fingerprinted and chained to the one before it.'}
        </p>
      </div>
    </div>
  )
}
