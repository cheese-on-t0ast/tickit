import type { RepeatRule } from '../types'
import { addDays, addMonths, parseISODate, todayISO, toISODate } from './date'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

export function describeRepeat(r: RepeatRule): string {
  switch (r.freq) {
    case 'daily':
      return r.n <= 1 ? 'Every day' : `Every ${r.n} days`
    case 'weekday':
      return 'Every weekday'
    case 'weekly':
      if (r.n <= 1) return 'Every week'
      if (r.n === 2) return 'Every other week'
      return `Every ${r.n} weeks`
    case 'monthly': {
      const base = r.n <= 1 ? 'Every month' : r.n === 3 ? 'Every 3 months' : `Every ${r.n} months`
      return r.dayOfMonth ? `${base} on the ${ordinal(r.dayOfMonth)}` : base
    }
    case 'yearly':
      return r.n <= 1 ? 'Every year' : `Every ${r.n} years`
    case 'weeklyOn':
      return `Every ${WEEKDAY_NAMES[r.weekday]}`
  }
}

/** Next occurrence date after completing a repeating task. */
export function nextOccurrence(fromDate: string | null, repeat: RepeatRule): string {
  const base = fromDate ?? todayISO()
  switch (repeat.freq) {
    case 'daily':
      return addDays(base, Math.max(1, repeat.n))
    case 'weekday': {
      let next = addDays(base, 1)
      while ([0, 6].includes(parseISODate(next).getDay())) next = addDays(next, 1)
      return next
    }
    case 'weekly':
      return addDays(base, 7 * Math.max(1, repeat.n))
    case 'monthly': {
      const next = addMonths(base, Math.max(1, repeat.n))
      if (!repeat.dayOfMonth) return next
      const d = parseISODate(next)
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const clamped = Math.min(repeat.dayOfMonth, daysInMonth)
      return toISODate(new Date(d.getFullYear(), d.getMonth(), clamped))
    }
    case 'yearly':
      return addMonths(base, 12 * Math.max(1, repeat.n))
    case 'weeklyOn':
      return addDays(base, 7)
  }
}
