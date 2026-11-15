import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LogoMark } from '../components/Logo'
import { api, type SharedPacket } from '../lib/api'
import { clockTime, dayLabel, duration, hoursText, money, shortDate } from '../lib/format'
import { ZERO_HASH, hashEntry, type Entry } from '../lib/hashchain'
import { findingText } from '../lib/findings'
import { LangSwitch, getLang, t } from '../lib/i18n'
import { pairShifts } from '../lib/shifts'

// The evidence packet. A read-only page anyone with the link can open, and the
// worker can save as a PDF. Every fingerprint is recomputed right here in the
// viewer's browser, so they do not have to take our server's word for it.

interface Recheck {
  checked: number
  brokenAt: number | null
}

async function recheck(packet: SharedPacket): Promise<Recheck> {
  let prev = ZERO_HASH
  for (const [index, raw] of packet.entries.entries()) {
    const entry = { ...raw, deviceId: packet.deviceId } as Entry
    const ok = entry.seq === index && entry.prevHash === prev && (await hashEntry(entry)) === entry.hash
    if (!ok) return { checked: index, brokenAt: index }
    prev = entry.hash
  }
  return { checked: packet.entries.length, brokenAt: null }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(getLang() === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label={t('Passed')}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-bad" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-label={t('Failed')}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export default function Packet() {
  const { shareId = '' } = useParams()
  const [packet, setPacket] = useState<SharedPacket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState<Recheck | null>(null)
  const [qr, setQr] = useState<string>('')
  const url = `${location.origin}/v/${shareId}`

  useEffect(() => {
    api
      .readShare(shareId)
      .then(async (data) => {
        setPacket(data)
        setLocal(await recheck(data))
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('This packet could not be loaded.')))
    QRCode.toString(url, { type: 'svg', margin: 0, color: { dark: '#17160f', light: '#00000000' } }).then(setQr)
  }, [shareId, url])

  if (error) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="grid justify-items-center gap-3">
          <LogoMark className="h-14 w-14" />
          <p className="font-display text-xl font-extrabold">{error}</p>
        </div>
      </div>
    )
  }
  if (!packet || !local) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status">
        <LogoMark className="h-14 w-14 animate-pulse" />
      </div>
    )
  }

  const check = packet.check
  const period = check?.payPeriod
  const inPeriod = (ts: string) => !period || (ts.slice(0, 10) >= period.start && ts.slice(0, 10) <= period.end)
  const shifts = pairShifts(packet.entries.map((e) => ({ ...e, deviceId: packet.deviceId }) as Entry)).filter((s) => inPeriod(s.inEntry.clientTs))
  const chainOk = local.brokenAt === null && packet.verify.valid
  const seal = packet.seal

  return (
    <div className="packet min-h-dvh bg-paper print:bg-white">
      <main className="mx-auto grid max-w-2xl grid-cols-1 gap-6 px-4 py-6 print:max-w-none print:py-0">
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div className="min-w-0 break-words">
            <div className="flex items-center gap-2 font-display text-xl font-extrabold">
              <LogoMark className="h-8 w-8" /> Stubborn
            </div>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight">{t('Pay evidence packet')}</h1>
            <p className="mt-1 text-muted">
              {packet.worker.name || t('Worker')}
              {packet.worker.employer && <> {t('at')} {packet.worker.employer}</>}
              {period && (
                <>
                  {' '}
                  · {t('pay period {start} to {end}', { start: shortDate(period.start), end: shortDate(period.end) })}
                </>
              )}
            </p>
            <p className="text-sm text-muted">{t('Made {when}', { when: when(packet.createdAt) })}</p>
          </div>
          <div className="w-24 shrink-0 text-center">
            <div className="aspect-square w-24" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="mt-1 text-[0.65rem] leading-tight text-muted">{t('Scan to check this packet')}</p>
          </div>
        </header>

        <div className="no-print flex items-center justify-end">
          <LangSwitch />
        </div>
        <div className="no-print flex gap-3">
          <button type="button" className="btn btn-primary !min-h-12 !text-base" onClick={() => window.print()}>
            {t('Save as PDF')}
          </button>
          <button
            type="button"
            className="btn btn-secondary !min-h-12 !text-base"
            onClick={() => (navigator.share ? navigator.share({ url }).catch(() => {}) : navigator.clipboard?.writeText(url))}
          >
            {t('Share link')}
          </button>
        </div>

        <section className={`rounded-2xl border-2 p-4 ${chainOk ? 'border-accent bg-accent-soft' : 'border-bad bg-bad-soft'}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold">{t('Is this log untouched?')}</h2>
            <span className={`stamp shrink-0 ${chainOk ? 'border-accent text-accent' : 'border-bad text-bad'}`}>{chainOk ? t('Verified') : t('Changed')}</span>
          </div>
          <ul className="mt-3 grid gap-2 text-[0.95rem]">
            <li className="flex gap-2">
              <Mark ok={local.brokenAt === null} />
              <span>
                <b>{t('Checked in your browser just now.')}</b>{' '}
                {local.brokenAt === null
                  ? t('All {n} fingerprints were recomputed on this device and every one matches, in an unbroken chain.', { n: local.checked })
                  : t('Entry {n} does not match its fingerprint, so the log was changed at or before that entry.', { n: local.brokenAt })}
              </span>
            </li>
            <li className="flex gap-2">
              <Mark ok={packet.verify.valid} />
              <span>
                <b>{t('Checked by the Stubborn server.')}</b>{' '}
                {packet.verify.valid
                  ? t('Same result: {n} entries, no changes.', { n: packet.verify.count })
                  : t('The chain breaks at entry {n}.', { n: packet.verify.brokenAtSeq ?? '' })}
              </span>
            </li>
            <li className="flex gap-2">
              {seal ? <Mark ok={seal.matches} /> : <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-ink/30" />}
              <span>
                <b>{t('Locked seal.')}</b>{' '}
                {seal
                  ? seal.matches
                    ? t("On {when} the log's latest fingerprint (#{hash}, entry {n}) was written to locked AWS storage that cannot be edited. Today's log still matches it.", {
                        when: when(seal.sealedAt),
                        hash: seal.headHash.slice(0, 10),
                        n: seal.count,
                      })
                    : t('The log no longer matches the fingerprint locked away on {when}. Entries up to {n} were changed after that.', {
                        when: when(seal.sealedAt),
                        n: seal.count,
                      })
                  : t('This log has not been sealed yet. Logs are sealed every night at 11:59 PM.')}
              </span>
            </li>
          </ul>
        </section>

        {check && (
          <section className="rounded-2xl border-2 border-ink bg-card p-4 print:break-inside-avoid">
            <h2 className="text-xl font-extrabold">{t('What the pay stub shows')}</h2>
            <div className="mt-3 grid gap-1 font-mono text-sm">
              <p className="leader"><span>{t("Hours in the worker's log")}</span><b>{hoursText(check.totals.loggedHours)} h</b></p>
              <p className="leader"><span>{t('Hours paid on the stub')}</span><b>{hoursText(check.totals.paidHours)} h</b></p>
              <p className="leader"><span>{t('Hourly rate on the stub')}</span><b>{money(check.rate)}</b></p>
              <p className="leader"><span>{t('Expected pay for logged hours')}</span><b>{money(check.totals.expectedGross)}</b></p>
              <p className="leader"><span>{t('Gross pay on the stub')}</span><b>{money(check.totals.grossPay)}</b></p>
            </div>
            <p className="mt-3 border-t-2 border-dashed border-ink/30 pt-3 font-display text-2xl font-extrabold">
              <span className="hl">{money(check.totals.owed)}</span> <span className="font-sans text-base font-bold">{t('possibly owed')}</span>
            </p>
            <ul className="mt-3 grid gap-2">
              {check.findings
                .filter((f) => f.code !== 'total')
                .map((f) => ({ f, text: findingText(f) }))
                .map(({ f, text }) => (
                  <li key={f.code} className="text-sm">
                    <p className="font-semibold">{text.label}</p>
                    <p className="font-mono text-xs text-muted">{text.math}</p>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              {t('Overtime is 1.5 times the regular rate for hours over 40 in a workweek (federal FLSA). The Arizona minimum wage used is {min} per hour.', { min: money(check.minimumWage) })}
            </p>
          </section>
        )}

        <section className="rounded-2xl border-2 border-ink bg-card p-0">
          <h2 className="border-b-2 border-ink px-4 py-3 text-xl font-extrabold">{t("Hours in the worker's own log")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.8rem] sm:text-sm">
              <thead className="font-sans text-xs uppercase text-muted">
                <tr className="border-b-2 border-ink/15">
                  <th className="py-2 pl-3 pr-1">{t('Day')}</th>
                  <th className="px-1 py-2">{t('In')}</th>
                  <th className="px-1 py-2">{t('Out')}</th>
                  <th className="px-1 py-2 text-right">{t('Hours')}</th>
                  <th className="py-2 pl-2 pr-3">#</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {shifts.map((s) => (
                  <tr key={s.inEntry.seq} className="border-b border-dashed border-ink/15 last:border-0">
                    <td className="whitespace-nowrap py-2 pl-3 pr-1 font-sans font-semibold">{dayLabel(s.inEntry.clientTs.slice(0, 10))}</td>
                    <td className="whitespace-nowrap px-1 py-2">{clockTime(s.inEntry.clientTs)}</td>
                    <td className="whitespace-nowrap px-1 py-2">{s.outEntry ? clockTime(s.outEntry.clientTs) : t('open')}</td>
                    <td className="whitespace-nowrap px-1 py-2 text-right">{s.outEntry ? duration(s.minutes) : ''}</td>
                    <td className="py-2 pl-2 pr-3 text-xs text-muted" title={t('Fingerprint')}>{(s.outEntry ?? s.inEntry).hash.slice(0, 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t-2 border-ink/15 px-4 py-3 text-xs leading-relaxed text-muted">
            {packet.entries.some((e) => e.lat !== null)
              ? t("Each clock-in and clock-out was stamped with the time and location on the worker's phone and sent to the Stubborn server, which recorded when it got it.")
              : t("Each clock-in and clock-out was stamped with the time on the worker's phone and sent to the Stubborn server, which recorded when it got it.")}{' '}
            {t("Each entry's fingerprint is a SHA-256 hash of its details plus the previous entry's fingerprint.")}
          </p>
        </section>

        <footer className="grid gap-2 border-t-2 border-dashed border-ink/30 pt-4 text-xs leading-relaxed text-muted">
          <p>
            {t('This packet flags possible underpayment for the worker to ask about. It is not legal advice and does not say anyone broke the law. The log shows it was not edited after the fact. It cannot prove the worker was at work.')}
          </p>
          <p className="break-all">{t('Link:')} {url}</p>
          <p>
            {t('Made with Stubborn, built by')}{' '}
            <a href="https://jayparmar9.vercel.app" target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline">
              Jay Parmar
            </a>{' '}
            {t('at')}{' '}
            <a href="https://sunhacks.io" target="_blank" rel="noopener noreferrer" className="font-bold text-ink underline">
              sunhacks 2026
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  )
}
