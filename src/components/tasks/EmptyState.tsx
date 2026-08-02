import type { AppNav } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import shared from '../../styles/shared.module.css'
import styles from './EmptyState.module.css'

interface EmptyStateProps {
  nav: AppNav
  projectId?: string
  listName?: string
}

/** Lists that exist to park things for later get the "not now" framing. */
const PLACEHOLDER_LIST_IDS = ['someday']

export function EmptyState({ nav, projectId, listName }: EmptyStateProps) {
  const { projects } = useAppStore()

  const projectName = projectId ? projects.find((p) => p.id === projectId)?.name : undefined
  const name = projectName ?? listName
  const heading = name ? `Nothing in ${name} — yet` : 'Nothing here yet'

  const body =
    projectId && PLACEHOLDER_LIST_IDS.includes(projectId)
      ? 'This is where things go when they matter but not now. Park an idea here and it stays out of Today until you schedule it.'
      : "Add your first task and it'll show up right here, ready to sort and schedule."

  return (
    <div className={styles.wrap}>
      <div className={styles.box}>
        <div className={styles.skeletonStack}>
          <div className={styles.skeletonBarWide} />
          <div className={styles.skeletonBarNarrow} />
        </div>
      </div>
      <h2 className={styles.heading}>{heading}</h2>
      <p className={styles.body}>{body}</p>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.primaryButton}
          style={{ background: 'var(--tk-accent)' }}
          onClick={() => nav.openQuick({ defaultListId: projectId })}
        >
          Add a task
        </button>
        <button type="button" className={shared.outlineButton}>
          Import from a list
        </button>
      </div>
    </div>
  )
}
