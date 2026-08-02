import { useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import type { AppNav } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { Icon } from '../common/Icon'
import { HelpPopover } from '../help/HelpPopover'
import { INBOX_ID, NEW_PROJECT_DOTS, slugifyProjectName } from '../../store/lists'
import { addDays, todayISO, weekStartOf } from '../../utils/date'
import styles from './Sidebar.module.css'

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac/i.test(navigator.platform ?? '') || /Mac/i.test(navigator.userAgent ?? '')
}

interface SidebarProps {
  nav: AppNav
}

export function Sidebar({ nav }: SidebarProps) {
  const { tasks, projects, settings, actions } = useAppStore()
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)
  const cancelingRef = useRef(false)

  const isMac = useMemo(isMacPlatform, [])
  const todayIso = todayISO()

  const todayCount = tasks.filter((t) => t.dueDate !== null && t.dueDate <= todayIso && !t.done).length
  const inboxCount = tasks.filter((t) => t.listId === INBOX_ID && !t.done).length

  const newProjectDot = NEW_PROJECT_DOTS[projects.length % NEW_PROJECT_DOTS.length]

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => a.order - b.order), [projects])

  const weekStart = weekStartOf(todayIso, settings.weekStart)
  const weekEnd = addDays(weekStart, 6)
  const weekTasks = tasks.filter((t) => t.dueDate !== null && t.dueDate >= weekStart && t.dueDate <= weekEnd)
  const weekDone = weekTasks.filter((t) => t.done).length
  const weekTotal = weekTasks.length
  const pct = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0
  const openThisWeek = weekTasks.filter((t) => !t.done).length
  const dueToday = tasks.filter((t) => t.dueDate === todayIso && !t.done).length

  function openNewProject() {
    setNewProjectOpen(true)
    setNewProjectName('')
  }

  function commitNewProject() {
    const name = newProjectName.trim()
    setNewProjectOpen(false)
    setNewProjectName('')
    if (name) {
      actions.addProject(name)
      const predictedId = slugifyProjectName(name, projects.map((p) => p.id).concat(INBOX_ID))
      nav.setView({ kind: 'project', projectId: predictedId })
    }
  }

  function handleNewProjectKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      cancelingRef.current = true
      setNewProjectOpen(false)
      setNewProjectName('')
    }
  }

  function handleNewProjectBlur() {
    if (cancelingRef.current) {
      cancelingRef.current = false
      return
    }
    commitNewProject()
  }

  function handleDeleteProject(e: MouseEvent, projectId: string) {
    e.stopPropagation()
    const n = tasks.filter((t) => t.listId === projectId).length
    nav.setDialog({
      kind: 'confirm',
      title: 'Delete project?',
      body:
        n > 0
          ? `The project and its ${n} tasks will be removed.`
          : 'The project is empty — nothing else will be lost.',
      okLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        actions.deleteProject(projectId)
        if (nav.view.kind === 'project' && nav.view.projectId === projectId) {
          nav.setView({ kind: 'today' })
        }
      },
    })
  }

  function handleProjectRowKeyDown(e: KeyboardEvent<HTMLDivElement>, projectId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      nav.setView({ kind: 'project', projectId })
    }
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brandRow}>
        <div className={styles.brandMark}>t</div>
        <span className={styles.brandName}>Maya&apos;s tickit</span>
      </div>

      <button type="button" className={styles.searchRow} onClick={() => nav.openSearch()}>
        <Icon name="search" size={15} className={styles.searchIcon} />
        <span className={styles.searchLabel}>Search</span>
        <span className={styles.kbd}>{isMac ? '⌘K' : 'Ctrl K'}</span>
      </button>

      <nav className={styles.navList}>
        <button
          type="button"
          className={`${styles.navRow} ${nav.view.kind === 'today' ? styles.navRowActive : ''}`}
          onClick={() => nav.setView({ kind: 'today' })}
        >
          <Icon name="today" size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Today</span>
          {todayCount > 0 && <span className={styles.badge}>{todayCount}</span>}
        </button>
        <button
          type="button"
          className={`${styles.navRow} ${nav.view.kind === 'calendar' ? styles.navRowActive : ''}`}
          onClick={() => nav.setView({ kind: 'calendar' })}
        >
          <Icon name="calendar" size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Calendar</span>
        </button>
        <button
          type="button"
          className={`${styles.navRow} ${nav.view.kind === 'inbox' ? styles.navRowActive : ''}`}
          onClick={() => nav.setView({ kind: 'inbox' })}
        >
          <Icon name="inbox" size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Inbox</span>
          {inboxCount > 0 && <span className={styles.badge}>{inboxCount}</span>}
        </button>
        <button
          type="button"
          className={`${styles.navRow} ${nav.view.kind === 'all' ? styles.navRowActive : ''}`}
          onClick={() => nav.setView({ kind: 'all' })}
        >
          <Icon name="list" size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>All tasks</span>
        </button>
      </nav>

      <div className={styles.sectionHeaderRow}>
        <span className={styles.sectionHeader}>Projects</span>
        <button
          type="button"
          className={styles.addProjectButton}
          onClick={openNewProject}
          title="New project"
        >
          +
        </button>
      </div>

      <div className={styles.projectList}>
        {sortedProjects.map((project) => {
          const active = nav.view.kind === 'project' && nav.view.projectId === project.id
          const count = tasks.filter((t) => t.listId === project.id && !t.done).length
          const hovered = hoveredProjectId === project.id
          return (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              className={`${styles.navRow} ${active ? styles.navRowActive : ''}`}
              onMouseEnter={() => setHoveredProjectId(project.id)}
              onMouseLeave={() => setHoveredProjectId((id) => (id === project.id ? null : id))}
              onClick={() => nav.setView({ kind: 'project', projectId: project.id })}
              onKeyDown={(e) => handleProjectRowKeyDown(e, project.id)}
            >
              <span className={styles.projectDot} style={{ background: project.dot }} />
              <span className={styles.navLabel}>{project.name}</span>
              {hovered ? (
                <button
                  type="button"
                  className={styles.trashButton}
                  onClick={(e) => handleDeleteProject(e, project.id)}
                  title="Delete project"
                >
                  <Icon name="trash" size={12} />
                </button>
              ) : (
                count > 0 && <span className={styles.badge}>{count}</span>
              )}
            </div>
          )
        })}
      </div>

      {newProjectOpen && (
        <div className={styles.newProjectRow}>
          <span className={styles.newProjectDot} style={{ background: newProjectDot }} />
          <input
            autoFocus
            className={styles.newProjectInput}
            value={newProjectName}
            placeholder="Project name"
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={handleNewProjectKeyDown}
            onBlur={handleNewProjectBlur}
          />
        </div>
      )}

      <div className={styles.bottomSection}>
        <div className={styles.weekCard}>
          <div className={styles.weekHeaderRow}>
            <span className={styles.weekTitle}>This week</span>
            <span className={styles.weekStat}>
              {weekDone}/{weekTotal} done
            </span>
          </div>
          <div className={styles.weekBarTrack}>
            <div className={styles.weekBarFill} style={{ width: `${pct}%` }} />
          </div>
          <div className={styles.weekNote}>
            {openThisWeek > 0
              ? `${openThisWeek} left, ${dueToday || 'no'} due today`
              : 'All clear — nothing left this week.'}
          </div>
        </div>

        <button
          type="button"
          className={`${styles.navRow} ${nav.view.kind === 'settings' ? styles.navRowActive : ''}`}
          onClick={() => nav.setView({ kind: 'settings' })}
        >
          <Icon name="settings" size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Settings</span>
        </button>
        <button
          type="button"
          className={`${styles.navRow} ${nav.helpOpen ? styles.helpRowOpen : styles.helpRowClosed}`}
          onClick={() => nav.toggleHelp()}
        >
          <Icon name="help" size={15} className={styles.navIcon} />
          <span className={styles.navLabel}>Help</span>
        </button>
        {nav.helpOpen && <HelpPopover nav={nav} />}
      </div>
    </aside>
  )
}
