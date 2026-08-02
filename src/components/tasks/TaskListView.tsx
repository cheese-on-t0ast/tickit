import type { Task } from '../../types'
import type { View, AppNav, Tab } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import {
  sortTasks,
  todayBuckets,
  listBuckets,
  projectBuckets,
  allBuckets,
  type TaskBucket,
} from '../../store/grouping'
import { todayISO } from '../../utils/date'
import { Icon } from '../common/Icon'
import { TaskGroup } from './TaskGroup'
import { EmptyState } from './EmptyState'
import styles from './TaskListView.module.css'

type ListView = Extract<View, { kind: 'today' } | { kind: 'inbox' } | { kind: 'all' } | { kind: 'project' }>

interface TaskListViewProps {
  view: ListView
  nav: AppNav
  searchQuery?: string
  /** Skip the kicker/title/blurb block — used when the host screen (the
   * mobile shell) already renders its own page header above this view. */
  hideHeader?: boolean
}

const SORT_LABEL: Record<AppNav['sort'], string> = {
  due: 'Due date',
  priority: 'Priority',
  manual: 'Manual',
}

const TAB_LABEL: Record<Tab, string> = {
  all: 'All',
  open: 'Open',
  completed: 'Completed',
}

const TABS: Tab[] = ['all', 'open', 'completed']

export function TaskListView({ view, nav, searchQuery, hideHeader }: TaskListViewProps) {
  const { tasks, projects, settings } = useAppStore()
  const isDesktop = useMediaQuery('(min-width: 860px)')

  const today = todayISO()

  // 1. base pool by view kind
  const pool: Task[] =
    view.kind === 'inbox'
      ? tasks.filter((t) => t.listId === 'inbox')
      : view.kind === 'project'
        ? tasks.filter((t) => t.listId === view.projectId)
        : tasks

  // 2. search filter
  const query = (searchQuery ?? '').trim().toLowerCase()
  const searchedPool = query ? pool.filter((t) => t.title.toLowerCase().includes(query)) : pool

  // 3. tab filter
  const tabFiltered = searchedPool.filter((t) => {
    if (nav.tab === 'open') return !t.done
    if (nav.tab === 'completed') return t.done
    return true
  })

  // 4. bucketing — always grouped by due-date range, sorted by due date
  // (then priority/manual, per the sort control) within each bucket.
  let buckets: TaskBucket[]
  if (view.kind === 'today') {
    buckets = todayBuckets(tabFiltered, today, settings.rollover).map((b) => ({
      ...b,
      tasks: sortTasks(b.tasks, nav.sort),
    }))
  } else if (view.kind === 'inbox') {
    buckets = listBuckets(tabFiltered, today, settings.rollover).map((b) => ({
      ...b,
      tasks: sortTasks(b.tasks, nav.sort),
    }))
  } else if (view.kind === 'project') {
    buckets = projectBuckets(tabFiltered, today).map((b) => ({
      ...b,
      tasks: sortTasks(b.tasks, nav.sort),
    }))
  } else {
    buckets = allBuckets(tabFiltered, today).map((b) => ({
      ...b,
      tasks: sortTasks(b.tasks, nav.sort),
    }))
  }

  const project = view.kind === 'project' ? projects.find((p) => p.id === view.projectId) : undefined

  const openCount =
    view.kind === 'today'
      ? tasks.filter((t) => !t.done && t.dueDate !== null && t.dueDate <= today).length
      : pool.filter((t) => !t.done).length

  const kicker =
    view.kind === 'today'
      ? 'Your day'
      : view.kind === 'inbox'
        ? 'Inbox'
        : view.kind === 'all'
          ? 'Every open task'
          : ''

  const title =
    view.kind === 'today'
      ? 'Today'
      : view.kind === 'inbox'
        ? 'Inbox'
        : view.kind === 'all'
          ? 'All tasks'
          : (project?.name ?? 'Project')

  const blurb =
    view.kind === 'today'
      ? "What's due today, plus anything overdue from before."
      : view.kind === 'inbox'
        ? 'Unsorted tasks that haven’t been filed into a project yet.'
        : view.kind === 'all'
          ? 'Every task across every project, sorted by due date.'
          : `Everything filed under ${project?.name ?? 'this project'}.`

  const searchEmpty = query.length > 0 && searchedPool.length === 0
  const overallEmpty = searchedPool.length === 0
  const nonEmptyBuckets = buckets.filter((b) => b.tasks.length > 0)

  // A genuinely empty list replaces the whole pane — no header, no tabs.
  if (overallEmpty && !searchEmpty) {
    return (
      <div className={styles.container} data-scroll>
        <EmptyState
          nav={nav}
          projectId={view.kind === 'project' ? view.projectId : undefined}
          listName={title}
        />
      </div>
    )
  }

  return (
    <div className={styles.container} data-scroll>
      <div className={`${styles.column} ${isDesktop ? styles.columnDesktop : styles.columnMobile}`}>
        {!hideHeader && (
          <div>
            {kicker && <div className={styles.kicker}>{kicker}</div>}
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{title}</h1>
              <span className={styles.metaCount}>{openCount > 0 ? `${openCount} open` : ''}</span>
            </div>
            <p className={styles.blurb}>{blurb}</p>
          </div>
        )}

        <div className={styles.tabsRow}>
          <div className={styles.tabs}>
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles.tab} ${nav.tab === t ? styles.tabActive : ''}`}
                onClick={() => nav.setTab(t)}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
          <button type="button" className={styles.sortControl} onClick={nav.cycleSort}>
            <Icon name="sort" size={13} />
            <span>{SORT_LABEL[nav.sort]}</span>
          </button>
        </div>

        <div className={styles.body}>
          {searchEmpty ? (
            <div className={styles.centeredNote}>Nothing matches &quot;{searchQuery}&quot;.</div>
          ) : tabFiltered.length === 0 ? (
            <div className={styles.centeredNote}>Nothing here.</div>
          ) : (
            <>
              {nonEmptyBuckets.map((b) => (
                <TaskGroup
                  key={b.key}
                  label={b.label}
                  bucketKey={b.key}
                  tasks={b.tasks}
                  nav={nav}
                  onAdd={
                    view.kind !== 'all' && b.key !== 'overdue'
                      ? () =>
                          nav.openQuick(
                            view.kind === 'project' ? { defaultListId: view.projectId } : undefined,
                          )
                      : undefined
                  }
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
