import { useState } from 'react'
import type { AppNav } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { Icon } from '../common/Icon'
import shared from '../../styles/shared.module.css'
import { TaskDetailContent } from './TaskDetailContent'
import styles from './TaskDetailPanel.module.css'

interface TaskDetailPanelProps {
  taskId: string
  nav: AppNav
}

export function TaskDetailPanel({ taskId, nav }: TaskDetailPanelProps) {
  const { tasks, actions } = useAppStore()
  const task = tasks.find((t) => t.id === taskId)
  const [menuOpen, setMenuOpen] = useState(false)

  if (!task) return null

  return (
    <div className={styles.backdrop} onClick={nav.closeDetail}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.menuWrap}>
            <button
              type="button"
              className={`${shared.iconButton} ${styles.headerBtn}`}
              onClick={() => setMenuOpen((v) => !v)}
              title="More"
            >
              <Icon name="more" size={16} />
            </button>
            {menuOpen && (
              <>
                <div className={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
                <div className={`${shared.card} ${styles.menu}`}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      actions.bumpTomorrow(task.id)
                      setMenuOpen(false)
                    }}
                  >
                    → Tomorrow
                  </button>
                  <button type="button" className={styles.menuItem} onClick={() => setMenuOpen(false)}>
                    Edit task
                  </button>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemDestructive}`}
                    onClick={() => {
                      nav.setDialog({
                        kind: 'confirm',
                        title: 'Delete task?',
                        body: `"${task.title}" will be deleted.`,
                        okLabel: 'Delete',
                        destructive: true,
                        onConfirm: () => {
                          actions.deleteTask(task.id)
                          nav.closeDetail()
                        },
                      })
                      setMenuOpen(false)
                    }}
                  >
                    Delete task
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className={`${shared.iconButton} ${styles.headerBtn}`}
            onClick={nav.closeDetail}
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className={styles.body} data-scroll>
          <TaskDetailContent task={task} nav={nav} />
        </div>
      </div>
    </div>
  )
}
