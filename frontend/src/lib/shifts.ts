// Pairs IN/OUT entries for display. The backend rules engine does the same
// pairing for the pay check; this copy only draws the log.
import type { Entry } from './hashchain'

export interface Shift {
  inEntry: Entry
  outEntry: Entry | null
  minutes: number
}

export interface DayGroup {
  date: string
  shifts: Shift[]
  minutes: number
}

export interface WeekGroup {
  weekStart: string
  weekEnd: string
  days: DayGroup[]
  minutes: number
}

export function pairShifts(entries: Entry[]): Shift[] {
  const shifts: Shift[] = []
  let open: Entry | null = null
  for (const entry of [...entries].sort((a, b) => a.seq - b.seq)) {
    if (entry.type === 'IN') {
      if (open) shifts.push({ inEntry: open, outEntry: null, minutes: 0 })
      open = entry
    } else if (open) {
      const ms = new Date(entry.clientTs).getTime() - new Date(open.clientTs).getTime()
      shifts.push({ inEntry: open, outEntry: entry, minutes: Math.max(0, ms / 60000) })
      open = null
    }
  }
  if (open) shifts.push({ inEntry: open, outEntry: null, minutes: 0 })
  return shifts
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Sunday through Saturday workweeks, newest first. Shifts sit on their clock-in day. */
export function groupByWeek(shifts: Shift[]): WeekGroup[] {
  const weeks = new Map<string, WeekGroup>()
  for (const shift of shifts) {
    const date = shift.inEntry.clientTs.slice(0, 10)
    const weekStart = addDays(date, -new Date(`${date}T00:00:00Z`).getUTCDay())
    let week = weeks.get(weekStart)
    if (!week) {
      week = { weekStart, weekEnd: addDays(weekStart, 6), days: [], minutes: 0 }
      weeks.set(weekStart, week)
    }
    let day = week.days.find((d) => d.date === date)
    if (!day) {
      day = { date, shifts: [], minutes: 0 }
      week.days.push(day)
    }
    day.shifts.push(shift)
    day.minutes += shift.minutes
    week.minutes += shift.minutes
  }
  const sorted = [...weeks.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart))
  for (const week of sorted) week.days.sort((a, b) => b.date.localeCompare(a.date))
  return sorted
}
