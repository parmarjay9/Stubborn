// Rules engine warnings in the current language, built from their codes.
import type { CheckResult } from './api'
import { clockTime, dayLabel } from './format'
import { t } from './i18n'

const TEXT: Record<string, string> = {
  unreadable_time: 'Entry {seq} has an unreadable time and was skipped.',
  in_without_out: 'Clock-in on {when} has no clock-out and was not counted.',
  out_without_in: 'Clock-out on {when} has no clock-in and was not counted.',
  ends_before_start: 'Shift on {day} ends before it starts and was not counted.',
  over_24_hours: 'Shift starting {day} is longer than 24 hours. Worth checking.',
  still_clocked_in: 'Clock-in on {when} has no clock-out yet and was not counted.',
  long_period: 'This pay period is longer than two weeks. Stubborn is built for weekly and biweekly pay.',
  no_hours: 'No logged hours were found inside this pay period, so there is nothing to compare.',
}

export function warningTexts(check: CheckResult): string[] {
  const details = check.warningDetails
  if (!details || details.length !== check.warnings.length) return check.warnings
  return details.map((detail, index) => {
    const template = TEXT[detail.code]
    if (!template) return check.warnings[index]
    const p = detail.params ?? {}
    const when = p.at ? t('{day} at {time}', { day: dayLabel(p.at.slice(0, 10)), time: clockTime(p.at) }) : ''
    const day = p.day ? dayLabel(p.day) : ''
    return t(template, { seq: p.seq ?? '', when, day })
  })
}
