import type { AppData, Project, Task } from '../types'
import { newId } from './id'
import { addDays, parseISODate, todayISO } from '../utils/date'

const PROJECTS: Project[] = [
  { id: 'product', name: 'Product', dot: '#7ba7c9', order: 0 },
  { id: 'design', name: 'Design', dot: '#c9a3c4', order: 1 },
  { id: 'personal', name: 'Personal', dot: '#a3c1a3', order: 2 },
  { id: 'someday', name: 'Someday', dot: '#d4c08a', order: 3 },
]

interface SeedSpec {
  title: string
  listId: string
  dueOffset?: number
  dueTime?: string
  priority?: Task['priority']
  tags?: string[]
  notes?: string
  done?: boolean
  subtasks?: [string, boolean][]
  group?: Task['group']
}

function nextWeekday(today: string, target: number): string {
  const d = parseISODate(today)
  const delta = ((target - d.getDay()) + 7) % 7 || 7
  return addDays(today, delta)
}

function buildTask(today: string, spec: SeedSpec): Task {
  const now = new Date().toISOString()
  return {
    id: newId(),
    title: spec.title,
    listId: spec.listId,
    done: spec.done ?? false,
    dueDate: spec.dueOffset !== undefined ? addDays(today, spec.dueOffset) : null,
    dueTime: spec.dueTime ?? null,
    priority: spec.priority ?? 'low',
    tags: spec.tags ?? [],
    notes: spec.notes ?? '',
    subtasks: (spec.subtasks ?? []).map(([title, done]) => ({ id: newId(), title, done })),
    comments: [],
    repeat: null,
    group: spec.group ?? 'later',
    createdAt: now,
    updatedAt: now,
  }
}

export function seedData(): AppData {
  const today = todayISO()
  const monday = nextWeekday(today, 1)

  const named: SeedSpec[] = [
    {
      title: 'Finish the onboarding drop-off audit',
      listId: 'product',
      dueOffset: -1,
      priority: 'high',
      tags: ['research'],
      notes: '41% of new users drop off between step 2 and step 3 of onboarding.',
      subtasks: [['Pull recordings from the last four weeks', true], ['Tag drop-off moments', false], ['Write up three fixes', false]],
    },
    {
      title: 'Review the Q3 roadmap draft',
      listId: 'product',
      dueOffset: 0,
      dueTime: '14:00',
      priority: 'high',
      tags: ['planning'],
      notes: 'Calendar sync vs. templates — figure out the sequencing risk before this goes wide.',
      subtasks: [['Read the draft end to end', true], ['Comment on the sequencing risk', false]],
    },
    {
      title: 'Ship the empty-state copy fixes',
      listId: 'design',
      dueOffset: 0,
      dueTime: '16:00',
      priority: 'med',
      tags: ['copy'],
      notes: 'Six empty states, one voice.',
      subtasks: [['Rewrite Someday + Archive', true], ['Hand off to Ravi', false]],
    },
    {
      title: 'Reply to Priya re: the pricing test',
      listId: 'inbox',
      priority: 'med',
      notes: 'Two-tier pricing test — she wants to know if we can start it this month.',
    },
    {
      title: 'Design review — calendar view',
      listId: 'design',
      dueOffset: 0,
      dueTime: '11:00',
      done: true,
      tags: ['review'],
      notes: 'Month grid landed well; week view still feels cramped at 13".',
      subtasks: [['Print the grid at 100%', true]],
    },
    {
      title: 'Draft the 2.4 changelog',
      listId: 'product',
      dueOffset: 1,
      priority: 'med',
      notes: 'Lead with quick capture.',
    },
    {
      title: 'Interview: senior PM candidate',
      listId: 'inbox',
      dueOffset: 1,
      dueTime: '15:00',
      priority: 'high',
      notes: 'Focus the hour on how they kill work, not how they ship it.',
    },
    {
      title: 'Book the team offsite flights',
      listId: 'personal',
      priority: 'low',
      notes: 'Four people, Lisbon, second week of next month.',
      group: 'next',
    },
    {
      title: 'Rewrite the notification settings screen',
      listId: 'design',
      priority: 'med',
      tags: ['ia'],
      notes: 'Nine toggles is eight too many.',
      group: 'next',
    },
    {
      title: 'Instrument the quick-capture funnel',
      listId: 'product',
      priority: 'high',
      notes: "We don't know keyboard vs. button capture usage.",
      group: 'next',
    },
    {
      title: 'Explore a week/agenda calendar layout',
      listId: 'product',
      priority: 'low',
      notes: 'Month view is orientation; week view is the working surface.',
      group: 'later',
    },
    {
      title: 'Retire the old tag picker',
      listId: 'design',
      priority: 'low',
      notes: 'Blocked on the filter rework.',
      group: 'later',
    },
  ]
  const backlogSpecs: Array<[string, string, Task['priority']?, string[]?]> = [
    ['Write the 2.5 planning brief', 'product', 'high'],
    ['Decide on calendar sync scope', 'product', 'high'],
    ['Audit the notification copy', 'design', 'med', ['copy']],
    ['Fix the tag picker on narrow widths', 'design', 'med'],
    ['Move the changelog to the docs site', 'product', 'low'],
    ['Rework the filter chips', 'design', 'med', ['ia']],
    ['Ask Ravi for the illustration files', 'inbox', 'low'],
    ['Chase the invoice from last month', 'personal', 'med'],
    ['Renew the domain', 'personal', 'low'],
    ['Book the dentist', 'personal', 'low'],
    ['Draft the pricing test plan', 'product', 'high', ['research']],
    ['Read the session recordings summary', 'product', 'low', ['research']],
    ['Simplify the onboarding checklist', 'design', 'high'],
    ['Spec the week view interactions', 'product', 'med'],
    ['Trim the settings screen to one column', 'design', 'low'],
    ['Set up the support inbox rules', 'inbox', 'low'],
    ['Reply to the accessibility audit', 'inbox', 'high', ['a11y']],
    ['Write the empty-state for Archive', 'design', 'med', ['copy']],
    ['Plan the offsite agenda', 'personal', 'med'],
    ['Cancel the unused analytics plan', 'personal', 'low'],
    ['Sketch a keyboard-first capture', 'someday', 'low'],
    ['Explore natural-language filters', 'someday', 'low'],
    ['Look at how others do recurrence', 'someday', 'low', ['research']],
    ['Archive last quarter’s research notes', 'product', 'low'],
  ]

  const tasks: Task[] = named.map((spec) => buildTask(today, spec))
  // "Book the team offsite flights" carries a real next-Monday due date.
  const offsite = tasks.find((t) => t.title === 'Book the team offsite flights')
  if (offsite) offsite.dueDate = monday

  backlogSpecs.forEach(([title, listId, priority, tags], i) => {
    const t = buildTask(today, { title, listId, priority, tags, group: 'later', done: i % 9 === 4 })
    tasks.push(t)
  })

  return {
    schemaVersion: 1,
    tasks,
    projects: PROJECTS,
    settings: {
      rollover: false,
      showDone: false,
      weekStart: 'mon',
      reminders: true,
      badge: true,
      haptics: true,
      appearance: 'system',
    },
  }
}
