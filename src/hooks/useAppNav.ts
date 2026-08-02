import { useState } from 'react'
import type { SortMode } from '../store/grouping'

export type View =
  | { kind: 'today' }
  | { kind: 'inbox' }
  | { kind: 'all' }
  | { kind: 'calendar' }
  | { kind: 'settings' }
  | { kind: 'project'; projectId: string }

export type Tab = 'all' | 'open' | 'completed'

export type Dialog =
  | { kind: 'confirm'; title: string; body: string; okLabel: string; destructive?: boolean; onConfirm: () => void }
  | { kind: 'askDone'; taskId: string }
  | { kind: 'reopen'; body: string; onConfirm: () => void }
  | null

export interface AppNav {
  view: View
  setView(v: View): void
  selectedTaskId: string | null
  openDetail(taskId: string): void
  closeDetail(): void
  quickOpen: boolean
  quickDefaultListId: string | null
  quickInitialText: string | null
  openQuick(opts?: { defaultListId?: string; initialText?: string }): void
  closeQuick(): void
  searchOpen: boolean
  openSearch(): void
  closeSearch(): void
  helpOpen: boolean
  toggleHelp(): void
  closeHelp(): void
  tab: Tab
  setTab(t: Tab): void
  sort: SortMode
  cycleSort(): void
  dialog: Dialog
  setDialog(d: Dialog): void
}

const SORT_CYCLE: SortMode[] = ['due', 'priority', 'manual']

export function useAppNav(): AppNav {
  const [view, setViewState] = useState<View>({ kind: 'today' })
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickDefaultListId, setQuickDefaultListId] = useState<string | null>(null)
  const [quickInitialText, setQuickInitialText] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('open')
  const [sort, setSort] = useState<SortMode>('due')
  const [dialog, setDialog] = useState<Dialog>(null)

  function setView(v: View) {
    setViewState(v)
    setTab('open')
  }

  return {
    view,
    setView,
    selectedTaskId,
    openDetail: (taskId) => setSelectedTaskId(taskId),
    closeDetail: () => setSelectedTaskId(null),
    quickOpen,
    quickDefaultListId,
    quickInitialText,
    openQuick: (opts) => {
      setQuickDefaultListId(opts?.defaultListId ?? null)
      setQuickInitialText(opts?.initialText ?? null)
      setQuickOpen(true)
    },
    closeQuick: () => setQuickOpen(false),
    searchOpen,
    openSearch: () => setSearchOpen(true),
    closeSearch: () => setSearchOpen(false),
    helpOpen,
    toggleHelp: () => setHelpOpen((h) => !h),
    closeHelp: () => setHelpOpen(false),
    tab,
    setTab,
    sort,
    cycleSort: () => setSort((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length]),
    dialog,
    setDialog,
  }
}
