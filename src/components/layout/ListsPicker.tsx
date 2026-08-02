import type { AppNav, View } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { INBOX_ID, INBOX_META } from '../../store/lists'
import { todayISO } from '../../utils/date'
import styles from './ListsPicker.module.css'

interface ListsPickerProps {
  nav: AppNav
  onPick: (view: View) => void
}

export function ListsPicker({ nav, onPick }: ListsPickerProps) {
  void nav
  const { tasks, projects } = useAppStore()
  const sortedProjects = [...projects].sort((a, b) => a.order - b.order)
  const today = todayISO()
  const todayCount = tasks.filter((t) => t.dueDate !== null && t.dueDate <= today && !t.done).length
  const inboxCount = tasks.filter((t) => t.listId === INBOX_ID && !t.done).length

  return (
    <div className={styles.picker} data-scroll>
      <div className={styles.heading}>Lists</div>

      <button type="button" className={styles.row} onClick={() => onPick({ kind: 'today' })}>
        <span className={styles.dot} style={{ background: '#9b9a97' }} />
        <span className={styles.label}>Today</span>
        <span className={styles.count}>{todayCount}</span>
        <span className={styles.chevron}>›</span>
      </button>

      <button type="button" className={styles.row} onClick={() => onPick({ kind: 'inbox' })}>
        <span className={styles.dot} style={{ background: INBOX_META.dot }} />
        <span className={styles.label}>Inbox</span>
        <span className={styles.count}>{inboxCount}</span>
        <span className={styles.chevron}>›</span>
      </button>

      {sortedProjects.map((project) => {
        const count = tasks.filter((t) => t.listId === project.id && !t.done).length
        return (
          <button
            key={project.id}
            type="button"
            className={styles.row}
            onClick={() => onPick({ kind: 'project', projectId: project.id })}
          >
            <span className={styles.dot} style={{ background: project.dot }} />
            <span className={styles.label}>{project.name}</span>
            <span className={styles.count}>{count}</span>
            <span className={styles.chevron}>›</span>
          </button>
        )
      })}
    </div>
  )
}
