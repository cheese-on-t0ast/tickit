import type { AppNav } from '../../hooks/useAppNav'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import shared from '../../styles/shared.module.css'
import styles from './Dialogs.module.css'

interface ReopenDialogProps {
  nav: AppNav
}

export function ReopenDialog({ nav }: ReopenDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 860px)')

  if (nav.dialog?.kind !== 'reopen') return null
  const dialog = nav.dialog

  return (
    <div
      className={isDesktop ? `${styles.backdrop} ${styles.backdropCenter}` : styles.backdrop}
      onClick={() => {}}
    >
      <div
        className={isDesktop ? styles.dialogDesktop : styles.dialogMobile}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={styles.title}>Reopen this task?</p>
        <p className={styles.body}>{dialog.body}</p>
        <div className={isDesktop ? styles.actionsRow : styles.actionsStack}>
          <button type="button" className={shared.outlineButton} onClick={() => nav.setDialog(null)}>
            Cancel
          </button>
          <button
            type="button"
            className={shared.accentButton}
            style={{ background: 'var(--tk-accent)' }}
            onClick={() => {
              dialog.onConfirm()
              nav.setDialog(null)
            }}
          >
            Reopen
          </button>
        </div>
      </div>
    </div>
  )
}
