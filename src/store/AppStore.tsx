import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { AppData, CommentEntry, Project, Settings, Subtask, Task } from '../types'
import { repository } from './storage'
import { seedData } from './seed'
import { newId } from './id'
import { nextOccurrence } from '../utils/repeat'
import { addDays, todayISO } from '../utils/date'
import { INBOX_ID, NEW_PROJECT_DOTS, slugifyProjectName } from './lists'

type Action =
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; id: string; patch: Partial<Task> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'SET_DONE'; id: string; done: boolean }
  | { type: 'BUMP_TOMORROW'; id: string }
  | { type: 'TOGGLE_SUBTASK'; taskId: string; subtaskId: string }
  | { type: 'ADD_SUBTASK'; taskId: string; title: string }
  | { type: 'ADD_COMMENT'; taskId: string; text: string }
  | { type: 'ADD_PROJECT'; name: string }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }

function touch<T extends { updatedAt: string }>(t: T): T {
  return { ...t, updatedAt: new Date().toISOString() }
}

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] }

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? touch({ ...t, ...action.patch }) : t)),
      }

    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) }

    case 'SET_DONE': {
      const tasks = state.tasks.flatMap((t) => {
        if (t.id !== action.id) return [t]
        const updated = touch({ ...t, done: action.done })
        if (action.done && t.repeat) {
          const now = new Date().toISOString()
          const spawned: Task = {
            ...t,
            id: newId(),
            done: false,
            dueDate: nextOccurrence(t.dueDate, t.repeat),
            subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
            comments: [],
            createdAt: now,
            updatedAt: now,
          }
          return [updated, spawned]
        }
        return [updated]
      })
      return { ...state, tasks }
    }

    case 'BUMP_TOMORROW':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? touch({ ...t, dueDate: addDays(todayISO(), 1), group: 'upcoming' }) : t,
        ),
      }

    case 'TOGGLE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? touch({
                ...t,
                subtasks: t.subtasks.map((s): Subtask =>
                  s.id === action.subtaskId ? { ...s, done: !s.done } : s,
                ),
              })
            : t,
        ),
      }

    case 'ADD_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId
            ? touch({ ...t, subtasks: [...t.subtasks, { id: newId(), title: action.title, done: false }] })
            : t,
        ),
      }

    case 'ADD_COMMENT': {
      const comment: CommentEntry = {
        id: newId(),
        who: 'Maya Renner',
        init: 'M',
        when: 'Just now',
        text: action.text,
      }
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? touch({ ...t, comments: [...t.comments, comment] }) : t,
        ),
      }
    }

    case 'ADD_PROJECT': {
      const existingIds = state.projects.map((p) => p.id).concat(INBOX_ID)
      const id = slugifyProjectName(action.name, existingIds)
      const dot = NEW_PROJECT_DOTS[state.projects.length % NEW_PROJECT_DOTS.length]
      const project: Project = { id, name: action.name, dot, order: state.projects.length }
      return { ...state, projects: [...state.projects, project] }
    }

    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        tasks: state.tasks.filter((t) => t.listId !== action.id),
      }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    default:
      return state
  }
}

export interface AppStoreActions {
  addTask(task: Task): void
  updateTask(id: string, patch: Partial<Task>): void
  deleteTask(id: string): void
  setDone(id: string, done: boolean): void
  bumpTomorrow(id: string): void
  toggleSubtask(taskId: string, subtaskId: string): void
  addSubtask(taskId: string, title: string): void
  addComment(taskId: string, text: string): void
  addProject(name: string): void
  deleteProject(id: string): void
  updateSettings(patch: Partial<Settings>): void
}

interface AppStoreValue extends AppData {
  actions: AppStoreActions
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => repository.load() ?? seedData())

  useEffect(() => {
    const timeout = setTimeout(() => repository.save(state), 300)
    return () => clearTimeout(timeout)
  }, [state])

  useEffect(() => {
    const handler = () => repository.save(state)
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [state])

  const actions = useMemo<AppStoreActions>(
    () => ({
      addTask: (task) => dispatch({ type: 'ADD_TASK', task }),
      updateTask: (id, patch) => dispatch({ type: 'UPDATE_TASK', id, patch }),
      deleteTask: (id) => dispatch({ type: 'DELETE_TASK', id }),
      setDone: (id, done) => dispatch({ type: 'SET_DONE', id, done }),
      bumpTomorrow: (id) => dispatch({ type: 'BUMP_TOMORROW', id }),
      toggleSubtask: (taskId, subtaskId) => dispatch({ type: 'TOGGLE_SUBTASK', taskId, subtaskId }),
      addSubtask: (taskId, title) => dispatch({ type: 'ADD_SUBTASK', taskId, title }),
      addComment: (taskId, text) => dispatch({ type: 'ADD_COMMENT', taskId, text }),
      addProject: (name) => dispatch({ type: 'ADD_PROJECT', name }),
      deleteProject: (id) => dispatch({ type: 'DELETE_PROJECT', id }),
      updateSettings: (patch) => dispatch({ type: 'UPDATE_SETTINGS', patch }),
    }),
    [],
  )

  const value = useMemo<AppStoreValue>(() => ({ ...state, actions }), [state, actions])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreValue {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useAppStore must be used within an AppStoreProvider')
  return ctx
}
