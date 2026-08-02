import type { AppNav } from '../../hooks/useAppNav'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useAppStore } from '../../store/AppStore'
import shared from '../../styles/shared.module.css'
import styles from './Dialogs.module.css'

interface AskDoneDialogProps {
  nav: AppNav
}

export function AskDoneDialog({ nav }: AskDoneDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 860px)')
  const { tasks, actions } = useAppStore()

  if (nav.dialog?.kind !== 'askDone') return null
  const dialog = nav.dialog
  const task = tasks.find((t) => t.id === dialog.taskId)
  if (!task) return null

  return (
    <div
      className={isDesktop ? `${styles.backdrop} ${styles.backdropCenter}` : styles.backdrop}
      onClick={() => {}}
    >
      <div
        className={isDesktop ? styles.dialogDesktop : styles.dialogMobile}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={styles.badge}
          style={{ background: 'var(--tk-accent)', color: 'var(--on-accent)' }}
        >
          ✓
        </div>
        <p className={styles.heading}>All subtasks completed</p>
        <p className={styles.body}>Mark &quot;{task.title}&quot; as complete?</p>
        <div className={isDesktop ? styles.actionsRow : styles.actionsStack}>
          <button type="button" className={shared.outlineButton} onClick={() => nav.setDialog(null)}>
            I&apos;m not done yet
          </button>
          <button
            type="button"
            className={shared.accentButton}
            style={{ background: 'var(--tk-accent)' }}
            onClick={() => {
              actions.setDone(dialog.taskId, true)
              nav.setDialog(null)
            }}
          >
            Tickit!
          </button>
        </div>
      </div>
    </div>
  )
}
