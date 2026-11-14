import { clockTime, dayLabel, decimalHours, duration, shortDate } from '../lib/format'
import type { Entry } from '../lib/hashchain'
import { groupByWeek, pairShifts } from '../lib/shifts'

export default function ShiftList({ entries }: { entries: Entry[] }) {
  const weeks = groupByWeek(pairShifts(entries))

  if (weeks.length === 0) {
    return (
      <div className="card text-center text-muted">
        <p className="font-semibold text-ink">No hours yet</p>
        <p className="mt-1 text-sm">Tap Clock in when your shift starts. Your hours will show up here.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {weeks.map((week) => (
        <section key={week.weekStart} className="card p-0">
          <header className="flex items-end justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Week of</p>
              <h3 className="font-bold">
                {shortDate(week.weekStart)} to {shortDate(week.weekEnd)}
              </h3>
            </div>
            <p className="text-right">
              <span className="text-3xl font-black tabular-nums">{decimalHours(week.minutes)}</span>
              <span className="ml-1 text-sm font-semibold text-muted">hours</span>
            </p>
          </header>
          <ul className="divide-y divide-line">
            {week.days.map((day) => (
              <li key={day.date} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-semibold">{dayLabel(day.date)}</p>
                  {day.shifts.map((shift) => (
                    <p key={shift.inEntry.seq} className="text-sm tabular-nums text-muted">
                      {clockTime(shift.inEntry.clientTs)} to {shift.outEntry ? clockTime(shift.outEntry.clientTs) : 'now (on the clock)'}
                      {shift.inEntry.lat !== null && (
                        <span title="Location stamped" aria-label="Location stamped" className="ml-1.5 text-accent">
                          ●
                        </span>
                      )}
                    </p>
                  ))}
                </div>
                <p className="font-semibold tabular-nums">{day.minutes > 0 ? duration(day.minutes) : ''}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-center text-xs text-muted">
        <span className="text-accent">●</span> means the entry carries a location stamp.
      </p>
    </div>
  )
}
