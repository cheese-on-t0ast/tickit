import type { Task } from '../types'
import { addDays, endOfMonthISO } from '../utils/date'

export interface TaskBucket {
  key: string
  label: string
  tasks: Task[]
}

export type SortMode = 'due' | 'priority' | 'manual'

const PRIO_RANK: Record<Task['priority'], number> = { high: 0, med: 1, low: 2 }

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  const arr = [...tasks]
  arr.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (mode === 'priority') return PRIO_RANK[a.priority] - PRIO_RANK[b.priority]
    if (mode === 'due') {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
      return (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99')
    }
    return 0
  })
  return arr
}

/** Overdue / Today buckets only — used by the Today nav view. */
export function todayBuckets(tasks: Task[], todayIso: string, rollover: boolean): TaskBucket[] {
  const due = tasks.filter((t) => t.dueDate !== null && t.dueDate <= todayIso)
  const overdue = due.filter((t) => t.dueDate! < todayIso)
  const today = due.filter((t) => t.dueDate! === todayIso)
  const buckets: TaskBucket[] = []
  if (rollover) {
    const merged = [...overdue, ...today]
    if (merged.length) buckets.push({ key: 'today', label: 'Today', tasks: merged })
  } else {
    if (overdue.length) buckets.push({ key: 'overdue', label: 'Overdue', tasks: overdue })
    if (today.length) buckets.push({ key: 'today', label: 'Today', tasks: today })
  }
  return buckets
}

/** Overdue / Today / Upcoming / No date — used by Inbox view. */
export function listBuckets(tasks: Task[], todayIso: string, rollover: boolean): TaskBucket[] {
  const overdue = tasks.filter((t) => t.dueDate !== null && t.dueDate < todayIso)
  const today = tasks.filter((t) => t.dueDate === todayIso)
  const upcoming = tasks.filter((t) => t.dueDate !== null && t.dueDate! > todayIso)
  const noDate = tasks.filter((t) => t.dueDate === null)
  const buckets: TaskBucket[] = []
  if (rollover) {
    const merged = [...overdue, ...today]
    if (merged.length) buckets.push({ key: 'today', label: 'Today', tasks: merged })
  } else {
    if (overdue.length) buckets.push({ key: 'overdue', label: 'Overdue', tasks: overdue })
    if (today.length) buckets.push({ key: 'today', label: 'Today', tasks: today })
  }
  if (upcoming.length) buckets.push({ key: 'upcoming', label: 'Upcoming', tasks: upcoming })
  if (noDate.length) buckets.push({ key: 'nodate', label: 'No date', tasks: noDate })
  return buckets
}

/** Overdue / Today / This Week / This Month / Later / No date — used by the
 * All Tasks view. Always sorted by due date within each bucket, regardless
 * of the sort control (bucketing by date already implies a due-date order —
 * "priority"/"manual" sort only makes sense within a single date bucket, so
 * the caller still applies `sortTasks` per bucket, just always in 'due' mode
 * for this particular grouping is not enforced here; see TaskListView). */
export function allBuckets(tasks: Task[], todayIso: string): TaskBucket[] {
  const endOfMonth = endOfMonthISO(todayIso)
  const weekCutoff = addDays(todayIso, 7)
  const overdue = tasks.filter((t) => t.dueDate !== null && t.dueDate < todayIso)
  const today = tasks.filter((t) => t.dueDate === todayIso)
  const thisWeek = tasks.filter((t) => t.dueDate !== null && t.dueDate > todayIso && t.dueDate <= weekCutoff)
  const thisMonth = tasks.filter(
    (t) => t.dueDate !== null && t.dueDate > weekCutoff && t.dueDate <= endOfMonth,
  )
  const later = tasks.filter((t) => t.dueDate !== null && t.dueDate > endOfMonth && t.dueDate > weekCutoff)
  const noDate = tasks.filter((t) => t.dueDate === null)
  const buckets: TaskBucket[] = []
  if (overdue.length) buckets.push({ key: 'overdue', label: 'Overdue', tasks: overdue })
  if (today.length) buckets.push({ key: 'today', label: 'Today', tasks: today })
  if (thisWeek.length) buckets.push({ key: 'week', label: 'This week', tasks: thisWeek })
  if (thisMonth.length) buckets.push({ key: 'month', label: 'This month', tasks: thisMonth })
  if (later.length) buckets.push({ key: 'later', label: 'Later', tasks: later })
  if (noDate.length) buckets.push({ key: 'nodate', label: 'No date', tasks: noDate })
  return buckets
}

/** Now / Next / Later — used by project views. */
export function projectBuckets(tasks: Task[], todayIso: string): TaskBucket[] {
  const now = tasks.filter((t) => t.dueDate !== null && t.dueDate! <= todayIso)
  const next = tasks.filter((t) => t.dueDate !== null && t.dueDate! > todayIso)
  const later = tasks.filter((t) => t.dueDate === null)
  const buckets: TaskBucket[] = []
  if (now.length) buckets.push({ key: 'now', label: 'Now', tasks: now })
  if (next.length) buckets.push({ key: 'next', label: 'Next', tasks: next })
  if (later.length) buckets.push({ key: 'later', label: 'Later', tasks: later })
  return buckets
}
