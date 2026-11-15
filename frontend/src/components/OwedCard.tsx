import type { CheckResult } from '../lib/api'
import { hoursText, money, shortDate } from '../lib/format'
import { t } from '../lib/i18n'

/** The headline result, printed like a receipt. Every figure is from the rules engine. */
export default function OwedCard({ check }: { check: CheckResult }) {
  const { totals } = check
  const owes = totals.owed !== '0.00'
  return (
    <section className="receipt-wrap pop">
      <div className="receipt px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="tag text-muted">{t('Stubborn pay check')}</p>
            <p className="text-sm font-bold">
              {t('{start} to {end}', { start: shortDate(check.payPeriod.start), end: shortDate(check.payPeriod.end) })}
            </p>
          </div>
          <span className={`stamp thunk shrink-0 ${owes ? 'border-bad text-bad' : 'border-accent text-accent'}`}>
            {owes ? t('Worth asking') : t('All good')}
          </span>
        </div>

        <div className="mt-4 grid gap-1 text-sm">
          <p className="leader"><span>{t('Your log')}</span><b>{hoursText(totals.loggedHours)} h</b></p>
          <p className="leader"><span>{t('Stub paid')}</span><b>{hoursText(totals.paidHours)} h</b></p>
          <p className="leader"><span>{t('Expected pay')}</span><b>{money(totals.expectedGross)}</b></p>
          <p className="leader"><span>{t('Stub gross pay')}</span><b>{money(totals.grossPay)}</b></p>
        </div>

        <div className="mt-4 border-t-2 border-dashed border-ink/40 pb-6 pt-5 text-center">
          <p className="font-display text-[4.2rem] font-extrabold leading-none tracking-tight">
            <span className="hl">{money(totals.owed)}</span>
          </p>
          <p className="mt-3 font-sans text-lg font-bold">
            {owes ? t('possibly owed to you this pay period') : t('Nothing looks missing this pay period')}
          </p>
        </div>
      </div>
    </section>
  )
}
