import { useState } from 'react'
import { t } from '../lib/i18n'

// A repeating calendar event for payday, as an .ics file. Works on any phone's
// calendar app, no install or notification permission needed.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const pad = (n: number) => String(n).padStart(2, '0')
const stamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`

/** Next date (today or later) that falls on the given weekday, as YYYYMMDD. */
function nextDate(weekday: number): string {
  const d = new Date()
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7))
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function buildIcs(weekday: number, every: 1 | 2, hour: number): string {
  const start = `${nextDate(weekday)}T${pad(hour)}0000`
  const link = `${location.origin}/check`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stubborn//Payday reminder//EN',
    'BEGIN:VEVENT',
    `UID:payday-${Date.now()}@stubborn`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${start}`,
    'DURATION:PT15M',
    `RRULE:FREQ=WEEKLY;INTERVAL=${every};BYDAY=${ICS_DAYS[weekday]}`,
    `SUMMARY:${t('Payday: snap your pay stub')}`,
    `DESCRIPTION:${t('Check your stub against your own hours in Stubborn:')} ${link}`,
    `URL:${link}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${t('Payday: snap your pay stub')}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export default function PaydayReminder() {
  const [weekday, setWeekday] = useState(5)
  const [every, setEvery] = useState<1 | 2>(2)
  const [added, setAdded] = useState(false)

  function download() {
    const blob = new Blob([buildIcs(weekday, every, 17)], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'stubborn-payday.ics'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    setAdded(true)
  }

  return (
    <section className="card grid gap-3">
      <div>
        <p className="tag text-muted">{t('Never miss a check')}</p>
        <h2 className="mt-1 text-xl font-extrabold">{t('Payday reminder')}</h2>
        <p className="mt-1 text-sm text-muted">{t("Adds a repeating reminder to your phone's calendar at 5 PM on payday.")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="payday-day" className="label">
            {t('Payday is on')}
          </label>
          <select id="payday-day" className="field" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {DAYS.map((day, index) => (
              <option key={day} value={index}>
                {t(day)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payday-every" className="label">
            {t('How often')}
          </label>
          <select id="payday-every" className="field" value={every} onChange={(e) => setEvery(Number(e.target.value) as 1 | 2)}>
            <option value={1}>{t('Every week')}</option>
            <option value={2}>{t('Every 2 weeks')}</option>
          </select>
        </div>
      </div>
      <button type="button" className="btn btn-secondary" onClick={download}>
        {t('Add to my calendar')}
      </button>
      {added && <p className="text-sm text-muted">{t('Open the downloaded file to add it to your calendar.')}</p>}
    </section>
  )
}
