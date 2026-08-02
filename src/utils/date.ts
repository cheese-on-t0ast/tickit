const DAY_MS = 24 * 60 * 60 * 1000

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Adds N months, clamping the day to the target month's length. */
export function addMonths(iso: string, n: number): string {
  const d = parseISODate(iso)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), daysInTarget))
  return toISODate(target)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / DAY_MS)
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Human label matching the mockup: "Today" / "Tomorrow" / "Yesterday" / "Wed Jul 30" */
export function dueDateLabel(iso: string, todayIso: string): string {
  const delta = daysBetween(todayIso, iso)
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  const d = parseISODate(iso)
  return `${WEEKDAY_SHORT[d.getDay()]} ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function weekStartOf(iso: string, weekStart: 'mon' | 'sun'): string {
  const d = parseISODate(iso)
  const dow = d.getDay()
  const offset = weekStart === 'mon' ? (dow + 6) % 7 : dow
  d.setDate(d.getDate() - offset)
  return toISODate(d)
}

export function isSameMonth(iso: string, year: number, month: number): boolean {
  const d = parseISODate(iso)
  return d.getFullYear() === year && d.getMonth() === month
}

/** Last day of the month containing `iso`, as an ISO date string. */
export function endOfMonthISO(iso: string): string {
  const d = parseISODate(iso)
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}
