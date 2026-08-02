export type Priority = 'high' | 'med' | 'low'

export type Group = 'overdue' | 'today' | 'upcoming' | 'next' | 'later'

/** n=1 means the plain "every day/week/month/year" case. */
export type RepeatRule =
  | { freq: 'daily'; n: number }
  | { freq: 'weekday' }
  | { freq: 'weekly'; n: number }
  | { freq: 'monthly'; n: number; dayOfMonth?: number }
  | { freq: 'yearly'; n: number }
  /** weekday 0=Sun..6=Sat, every `n` weeks (n=2 -> "every other Thursday"). */
  | { freq: 'weeklyOn'; weekday: number; n: number }
  /** The `week`-th weekday of every `n` months; week 1..5 or -1 for "last". */
  | { freq: 'monthlyDow'; n: number; week: number; weekday: number }

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface CommentEntry {
  id: string
  who: string
  init: string
  when: string
  text: string
}

export interface Task {
  id: string
  title: string
  listId: string
  done: boolean
  /** ISO yyyy-mm-dd, or null if no due date */
  dueDate: string | null
  /** "HH:MM" 24h, or null */
  dueTime: string | null
  priority: Priority
  tags: string[]
  notes: string
  subtasks: Subtask[]
  comments: CommentEntry[]
  repeat: RepeatRule | null
  group: Group
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  dot: string
  order: number
}

export type Appearance = 'light' | 'dark' | 'system'

export interface Settings {
  rollover: boolean
  showDone: boolean
  weekStart: 'mon' | 'sun'
  reminders: boolean
  badge: boolean
  haptics: boolean
  appearance: Appearance
}

export interface AppData {
  schemaVersion: 1
  tasks: Task[]
  projects: Project[]
  settings: Settings
}

export interface ParsedCapture {
  title: string
  listId: string
  listGiven: boolean
  priority: Priority
  tags: string[]
  dueDate: string | null
  dueTime: string | null
  label: string
  repeat: RepeatRule | null
  group: Group
  dated: boolean
}
