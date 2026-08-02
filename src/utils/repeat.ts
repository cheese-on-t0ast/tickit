import type { RepeatRule } from '../types'
import { addDays, addMonths, parseISODate, todayISO, toISODate } from './date'

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEK_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth']

/** "every month" / "every 3 months" / "every N months" phrasing helper. */
function everyMonths(n: number): string {
  return n <= 1 ? 'every month' : `every ${n} months`
}

/** Day-of-month of the `week`-th `weekday` (0=Sun) in the given month.
 *  week 1..5, or -1 for the last such weekday; a missing 5th clamps to last. */
function nthWeekdayOfMonth(year: number, month: number, week: number, weekday: number): number {
  const firstDow = new Date(year, month, 1).getDay()
  const firstOcc = 1 + ((weekday - firstDow + 7) % 7)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  if (week <= -1) {
    let day = firstOcc
    while (day + 7 <= daysInMonth) day += 7
    return day
  }
  let day = firstOcc + (Math.max(1, week) - 1) * 7
  while (day > daysInMonth) day -= 7
  return day
}

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
    case 'weeklyOn': {
      const day = WEEKDAY_NAMES[r.weekday]
      if (r.n <= 1) return `Every ${day}`
      if (r.n === 2) return `Every other ${day}`
      return `Every ${r.n} weeks on ${day}`
    }
    case 'monthlyDow': {
      const day = WEEKDAY_NAMES[r.weekday]
      const which = r.week === -1 ? 'last' : WEEK_ORDINALS[r.week - 1] ?? 'first'
      return `The ${which} ${day} of ${everyMonths(r.n)}`
    }
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
      // `base` already sits on the target weekday, so stepping whole weeks
      // keeps it there.
      return addDays(base, 7 * Math.max(1, repeat.n))
    case 'monthlyDow': {
      const d = parseISODate(base)
      const target = new Date(d.getFullYear(), d.getMonth() + Math.max(1, repeat.n), 1)
      const day = nthWeekdayOfMonth(target.getFullYear(), target.getMonth(), repeat.week, repeat.weekday)
      return toISODate(new Date(target.getFullYear(), target.getMonth(), day))
    }
  }
}
