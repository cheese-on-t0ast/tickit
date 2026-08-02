import type { AppNav } from '../../hooks/useAppNav'
import shared from '../../styles/shared.module.css'
import styles from './TopBar.module.css'

interface TopBarProps {
  nav: AppNav
}

export function TopBar({ nav }: TopBarProps) {
  function handleNewClick() {
    nav.openQuick(nav.view.kind === 'project' ? { defaultListId: nav.view.projectId } : undefined)
  }

  return (
    <header className={styles.topBar}>
      <button
        type="button"
        className={`${shared.accentButton} ${styles.newButton}`}
        onClick={handleNewClick}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>+</span>
        New
      </button>
    </header>
  )
}
