import { useState } from 'react'
import type { AppNav, View } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { Icon } from '../common/Icon'
import { TaskListView } from '../tasks/TaskListView'
import { CalendarView } from '../calendar/CalendarView'
import { SettingsView } from '../settings/SettingsView'
import { TaskDetailSheet } from '../detail/TaskDetailSheet'
import { MobileQuickCapture } from '../capture/MobileQuickCapture'
import { BottomTabBar, type MobileTab } from './BottomTabBar'
import { Fab } from './Fab'
import { ListsPicker } from './ListsPicker'
import { INBOX_ID } from '../../store/lists'
import { todayISO } from '../../utils/date'
import styles from './MobileShell.module.css'

interface MobileShellProps {
  nav: AppNav
}

function MobileListsContent({ nav }: { nav: AppNav }) {
  // Defensive fallback only — activeTab === 'lists' && !showListsPicker guarantees
  // nav.view.kind is 'inbox' | 'all' | 'project' by construction, never these.
  if (nav.view.kind === 'calendar' || nav.view.kind === 'settings' || nav.view.kind === 'today') return null
  return (
    <TaskListView
      view={nav.view as Extract<View, { kind: 'inbox' } | { kind: 'all' } | { kind: 'project' }>}
      nav={nav}
      hideHeader
    />
  )
}

export function MobileShell({ nav }: MobileShellProps) {
  const { tasks, projects } = useAppStore()
  const [showListsPicker, setShowListsPicker] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')

  const activeTab: MobileTab = showListsPicker
    ? 'lists'
    : nav.view.kind === 'today'
      ? 'today'
      : nav.view.kind === 'calendar'
        ? 'calendar'
        : nav.view.kind === 'settings'
          ? 'settings'
          : 'lists'

  function selectTab(tab: MobileTab) {
    if (tab === 'lists') {
      setShowListsPicker(true)
      return
    }
    setShowListsPicker(false)
    if (tab === 'today') nav.setView({ kind: 'today' })
    else if (tab === 'calendar') nav.setView({ kind: 'calendar' })
    else if (tab === 'settings') nav.setView({ kind: 'settings' })
  }

  const view = nav.view
  const pageTitle = showListsPicker
    ? 'Lists'
    : view.kind === 'today'
      ? 'Today'
      : view.kind === 'calendar'
        ? 'Calendar'
        : view.kind === 'settings'
          ? 'Settings'
          : view.kind === 'inbox'
            ? 'Inbox'
            : view.kind === 'all'
              ? 'All tasks'
              : (projects.find((p) => p.id === view.projectId)?.name ?? 'Project')

  const kicker =
    view.kind === 'today'
      ? 'Your day'
      : view.kind === 'inbox'
        ? 'Unsorted'
        : view.kind === 'all'
          ? 'Everything'
          : view.kind === 'project'
            ? 'Project'
            : ''

  // Best-effort "N open · M done" for the screen's own pool.
  const today = todayISO()
  const pool =
    view.kind === 'today'
      ? tasks.filter((t) => t.dueDate !== null && t.dueDate <= today)
      : view.kind === 'inbox'
        ? tasks.filter((t) => t.listId === INBOX_ID)
        : view.kind === 'project'
          ? tasks.filter((t) => t.listId === view.projectId)
          : tasks
  const openCount = pool.filter((t) => !t.done).length
  const doneCount = pool.filter((t) => t.done).length
  const metaLine = `${openCount} open · ${doneCount} done`

  // Today plus the inbox/project/all lists all render as the same scrolling
  // list screen; the picker, calendar and settings screens own their headings.
  const isListScreen = activeTab === 'today' || (activeTab === 'lists' && !showListsPicker)

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        {isListScreen && (
          <div className={styles.scroller} data-scroll>
            {kicker && <div className={styles.kicker}>{kicker}</div>}
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{pageTitle}</h1>
              {activeTab === 'today' && (
                <button
                  type="button"
                  className={`${styles.searchToggle} ${mobileSearchOpen ? styles.searchToggleOpen : ''}`}
                  onClick={() => setMobileSearchOpen((o) => !o)}
                  title="Search"
                >
                  <Icon name="search" size={18} strokeWidth={1.9} />
                </button>
              )}
            </div>

            {mobileSearchOpen && activeTab === 'today' && (
              <div className={styles.searchRow}>
                <Icon name="search" size={15} strokeWidth={1.9} className={styles.searchIcon} />
                <input
                  autoFocus
                  className={styles.searchInput}
                  placeholder="Search tasks and notes"
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                />
                {mobileSearchQuery && (
                  <button
                    type="button"
                    className={styles.searchClear}
                    onClick={() => setMobileSearchQuery('')}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            <div className={styles.meta}>{metaLine}</div>

            {activeTab === 'today' ? (
              <TaskListView
                view={{ kind: 'today' }}
                nav={nav}
                searchQuery={mobileSearchOpen ? mobileSearchQuery : undefined}
                hideHeader
              />
            ) : (
              <MobileListsContent nav={nav} />
            )}
          </div>
        )}
        {activeTab === 'lists' && showListsPicker && (
          <ListsPicker
            nav={nav}
            onPick={(v: View) => {
              nav.setView(v)
              setShowListsPicker(false)
            }}
          />
        )}
        {activeTab === 'calendar' && <CalendarView nav={nav} />}
        {activeTab === 'settings' && <SettingsView nav={nav} />}

        {!nav.quickOpen && !nav.selectedTaskId && <Fab nav={nav} />}
      </div>

      <BottomTabBar active={activeTab} onSelect={selectTab} />

      {nav.selectedTaskId && <TaskDetailSheet taskId={nav.selectedTaskId} nav={nav} />}
      {nav.quickOpen && <MobileQuickCapture nav={nav} />}
    </div>
  )
}
