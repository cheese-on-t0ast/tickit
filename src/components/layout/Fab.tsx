import type { AppNav } from '../../hooks/useAppNav'
import styles from './Fab.module.css'

interface FabProps {
  nav: AppNav
}

export function Fab({ nav }: FabProps) {
  return (
    <button
      type="button"
      className={styles.fab}
      title="New task"
      onClick={() => nav.openQuick(nav.view.kind === 'project' ? { defaultListId: nav.view.projectId } : undefined)}
    >
      +
    </button>
  )
}
