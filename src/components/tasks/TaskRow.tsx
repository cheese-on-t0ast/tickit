import { useState } from 'react'
import type { Task } from '../../types'
import type { AppNav } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useResolvedTheme } from '../../hooks/useResolvedTheme'
import { useSwipe } from '../../hooks/useSwipe'
import { Checkbox } from '../common/Checkbox'
import { Icon } from '../common/Icon'
import { PRIO_COLOR, getChipColors, getListMeta } from '../../store/lists'
import { dueDateLabel, formatTime12, todayISO } from '../../utils/date'
import styles from './TaskRow.module.css'

interface TaskRowProps {
  task: Task
  nav: AppNav
}

export function TaskRow({ task, nav }: TaskRowProps) {
  const { actions, projects, settings } = useAppStore()
  const isDesktop = useMediaQuery('(min-width: 860px)')
  const dark = useResolvedTheme(settings.appearance) === 'dark'
  const [hovered, setHovered] = useState(false)

  const listDot = getListMeta(task.listId, projects).dot
  const chip = getChipColors(task.listId, listDot, dark)

  function confirmDelete() {
    nav.setDialog({
      kind: 'confirm',
      title: 'Delete task?',
      body: `"${task.title}" will be deleted.`,
      okLabel: 'Delete',
      destructive: true,
      onConfirm: () => actions.deleteTask(task.id),
    })
  }

  const swipe = useSwipe({
    onSwipeRight: () => actions.bumpTomorrow(task.id),
    onSwipeLeft: confirmDelete,
  })

  const today = todayISO()
  const overdue = task.dueDate !== null && task.dueDate < today

  function handleClick() {
    if (!isDesktop && swipe.wasSwipe()) return
    nav.openDetail(task.id)
  }

  const titleStyle = {
    textDecoration: task.done ? ('line-through' as const) : ('none' as const),
    color: task.done ? 'rgba(var(--fgc),.34)' : 'var(--fg)',
  }

  const metaCluster = (
    <div className={styles.meta}>
      {task.tags.map((tag) => (
        <span key={tag} className={styles.tag} style={{ background: chip.bg, color: chip.fg }}>
          {tag}
        </span>
      ))}
      {task.repeat && (
        <span className={styles.repeatGlyph} title="Repeats">
          ↻
        </span>
      )}
      {task.dueDate && (
        <span className={styles.due} style={{ color: overdue ? '#b4635c' : 'rgba(var(--fgc),.45)' }}>
          {dueDateLabel(task.dueDate, today)}
          {task.dueTime ? ` · ${formatTime12(task.dueTime)}` : ''}
        </span>
      )}
      <span className={styles.prioDot} style={{ background: PRIO_COLOR[task.priority] }} />
    </div>
  )

  if (isDesktop) {
    return (
      <div
        className={styles.row}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
      >
        <Checkbox done={task.done} onToggle={() => actions.setDone(task.id, !task.done)} />
        <span className={styles.title} style={titleStyle}>
          {task.title}
        </span>
        {hovered ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.actionPill}
              onClick={(e) => {
                e.stopPropagation()
                actions.bumpTomorrow(task.id)
              }}
            >
              → Tomorrow
            </button>
            <button
              type="button"
              className={styles.actionPill}
              onClick={(e) => {
                e.stopPropagation()
                nav.openDetail(task.id)
              }}
            >
              Edit
            </button>
            <button
              type="button"
              className={styles.deleteIconBtn}
              title="Delete"
              onClick={(e) => {
                e.stopPropagation()
                confirmDelete()
              }}
            >
              <Icon name="trash" size={12} />
            </button>
          </div>
        ) : (
          metaCluster
        )}
      </div>
    )
  }

  return (
    <div className={styles.rowMobile} {...swipe.handlers}>
      <div
        className={`${styles.underlay} ${styles.underlayBump}`}
        style={{ opacity: swipe.showBump ? 1 : 0 }}
      >
        → Tomorrow
      </div>
      <div
        className={`${styles.underlay} ${styles.underlayDelete}`}
        style={{ opacity: swipe.showDelete ? 1 : 0 }}
      >
        Delete ✕
      </div>
      <div
        className={styles.foreground}
        style={{
          transform: `translateX(${swipe.dx}px)`,
          transition: swipe.dragging ? 'none' : 'transform .22s cubic-bezier(.2,.8,.3,1)',
        }}
        onClick={handleClick}
      >
        <Checkbox done={task.done} onToggle={() => actions.setDone(task.id, !task.done)} />
        <span className={styles.title} style={titleStyle}>
          {task.title}
        </span>
        {metaCluster}
      </div>
    </div>
  )
}
