import type { Finding } from '../lib/api'
import { money } from '../lib/format'

/** Every line and number here comes straight from the rules engine. */
export default function Breakdown({ findings }: { findings: Finding[] }) {
  return (
    <section className="card p-0">
      <h2 className="border-b-2 border-ink px-5 py-3 text-xl font-extrabold">How we got there</h2>
      <ul className="divide-y-2 divide-dashed divide-ink/15">
        {findings.map((finding) => (
          <li key={finding.code}>
            <details className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
                <span className={finding.code === 'total' ? 'font-display text-lg font-extrabold' : 'font-medium'}>{finding.label}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {finding.amount && finding.code !== 'total' && (
                    <span className="font-mono font-bold">{money(finding.amount)}</span>
                  )}
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-muted transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <p className="mt-2 rounded-lg border-2 border-dashed border-ink/25 bg-paper px-3 py-2 font-mono text-xs leading-relaxed text-muted">{finding.math}</p>
            </details>
          </li>
        ))}
      </ul>
      <p className="tag border-t-2 border-ink px-5 py-3 text-muted">Tap a line to see the math</p>
    </section>
  )
}
