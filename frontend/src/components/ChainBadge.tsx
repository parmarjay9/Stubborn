import type { VerifyResult } from '../lib/api'

export default function ChainBadge({ result, failed }: { result: VerifyResult | null; failed?: boolean }) {
  if (failed) {
    return <div className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">Could not check the log right now.</div>
  }
  if (!result) return <div className="skeleton h-14" aria-label="Checking your log" />

  if (!result.valid) {
    return (
      <div role="status" className="pop flex items-center gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-bad">
        <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 3l9 16H3z" strokeLinejoin="round" />
          <path d="M12 10v4M12 17v.5" />
        </svg>
        <div>
          <p className="font-bold">Log was changed at entry {result.brokenAtSeq}</p>
          <p className="text-sm">The chain of hashes no longer matches from that entry on.</p>
        </div>
      </div>
    )
  }

  return (
    <div role="status" className="pop flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 text-accent-dark">
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
        <path d="M8.5 12l2.5 2.5 4.5-5" />
      </svg>
      <div>
        <p className="font-bold">
          {result.count === 0 ? 'Log ready' : `Log verified, ${result.count} ${result.count === 1 ? 'entry' : 'entries'}, untouched`}
        </p>
        <p className="text-sm">
          {result.count === 0 ? 'Your first clock-in starts the chain.' : 'Every entry is hashed and chained to the one before it.'}
        </p>
      </div>
    </div>
  )
}
