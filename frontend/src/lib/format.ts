// Display helpers only. All money math happens in the backend rules engine.

/** "123.25" -> "$123.25". The input is already an exact cents string. */
export function money(value: string): string {
  const [whole, cents = '00'] = value.replace(/^-/, '').split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${value.startsWith('-') ? '-' : ''}$${grouped}.${cents.padEnd(2, '0').slice(0, 2)}`
}

/** "43.50" -> "43.5", "2.00" -> "2". */
export function hoursText(value: string): string {
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value
}

/** Minutes -> "8h 30m". */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Minutes -> "43.5" hours with up to 2 decimals. */
export function decimalHours(minutes: number): string {
  return hoursText((minutes / 60).toFixed(2))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local time as ISO 8601 with offset, e.g. 2026-11-10T08:02:11-07:00. */
export function localIso(date: Date): string {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

/** Wall-clock time from a stored clientTs, e.g. "8:02 AM". */
export function clockTime(clientTs: string): string {
  const hour = Number(clientTs.slice(11, 13))
  const minute = clientTs.slice(14, 16)
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${hour < 12 ? 'AM' : 'PM'}`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-10" -> "Tue, Nov 10". */
export function dayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return `${DAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

/** "2026-11-10" -> "Nov 10". */
export function shortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`)
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}
