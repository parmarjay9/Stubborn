import { clockTime, dayLabel, decimalHours, duration, shortDate } from '../lib/format'
import type { Entry } from '../lib/hashchain'
import { groupByWeek, pairShifts } from '../lib/shifts'

/** The log, drawn as a punched timecard: one card per workweek. */
export default function ShiftList({ entries }: { entries: Entry[] }) {
  const weeks = groupByWeek(pairShifts(entries))

  if (weeks.length === 0) {
    return (
      <div className="card text-center">
        <p className="font-display text-xl font-extrabold">A blank timecard</p>
        <p className="mt-1 text-sm text-muted">Tap Clock in when your shift starts. Your hours will stack up here.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5">
      {weeks.map((week) => (
        <section key={week.weekStart} className="card p-0">
          <header className="flex items-end justify-between gap-3 border-b-2 border-ink px-4 py-3">
            <div>
              <p className="tag text-muted">Timecard, week of</p>
              <h3 className="text-lg font-extrabold">
                {shortDate(week.weekStart)} to {shortDate(week.weekEnd)}
              </h3>
            </div>
            <p className="text-right leading-none">
              <span className="hl font-mono text-3xl font-bold">{decimalHours(week.minutes)}</span>
              <span className="tag ml-1.5 text-muted">hours</span>
            </p>
          </header>
          <ul className="divide-y-2 divide-dashed divide-ink/15">
            {week.days.map((day) => (
              <li key={day.date} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-bold">{dayLabel(day.date)}</p>
                  {day.shifts.map((shift) => (
                    <p key={shift.inEntry.seq} className="font-mono text-sm text-muted">
                      {clockTime(shift.inEntry.clientTs)} to {shift.outEntry ? clockTime(shift.outEntry.clientTs) : 'now (on the clock)'}
                      {(shift.inEntry.pending || shift.outEntry?.pending) && (
                        <span className="ml-1.5 rounded border border-ink/40 px-1 font-sans text-[0.7rem] font-bold uppercase text-ink">
                          Not sent yet
                        </span>
                      )}
                      {shift.inEntry.lat !== null && (
                        <span title="Location stamped" aria-label="Location stamped" className="ml-1.5 text-accent">
                          ●
                        </span>
                      )}
                    </p>
                  ))}
                </div>
                <p className="font-mono font-bold">{day.minutes > 0 ? duration(day.minutes) : ''}</p>
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
