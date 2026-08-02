import type { AppNav } from '../../hooks/useAppNav'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import shared from '../../styles/shared.module.css'
import styles from './Dialogs.module.css'

interface ConfirmDialogProps {
  nav: AppNav
}

export function ConfirmDialog({ nav }: ConfirmDialogProps) {
  const isDesktop = useMediaQuery('(min-width: 860px)')

  if (nav.dialog?.kind !== 'confirm') return null
  const dialog = nav.dialog

  const content = (
    <div
      className={isDesktop ? styles.dialogDesktop : styles.dialogMobile}
      onClick={(e) => e.stopPropagation()}
    >
      <p className={styles.title}>{dialog.title}</p>
      <p className={styles.body}>{dialog.body}</p>
      <div className={isDesktop ? styles.actionsRow : styles.actionsStack}>
        <button type="button" className={shared.outlineButton} onClick={() => nav.setDialog(null)}>
          Cancel
        </button>
        <button
          type="button"
          className={dialog.destructive ? shared.destructiveButton : shared.accentButton}
          style={dialog.destructive ? undefined : { background: 'var(--tk-accent)' }}
          onClick={() => {
            dialog.onConfirm()
            nav.setDialog(null)
          }}
        >
          {dialog.okLabel}
        </button>
      </div>
    </div>
  )

  return (
    <div
      className={isDesktop ? `${styles.backdrop} ${styles.backdropCenter}` : styles.backdrop}
      onClick={() => {}}
    >
      {content}
    </div>
  )
}
