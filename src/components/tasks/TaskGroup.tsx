import type { Task } from '../../types'
import type { AppNav } from '../../hooks/useAppNav'
import { TaskRow } from './TaskRow'
import styles from './TaskGroup.module.css'

interface TaskGroupProps {
  label: string
  tasks: Task[]
  nav: AppNav
  onAdd?: () => void
  bucketKey?: string
}

export function TaskGroup({ label, tasks, nav, onAdd, bucketKey }: TaskGroupProps) {
  const overdue = bucketKey === 'overdue'
  return (
    <div className={styles.group}>
      <div className={styles.header}>
        <span className={`${styles.label} ${overdue ? styles.labelOverdue : ''}`}>{label}</span>
        <span className={styles.count}>{tasks.length > 0 ? tasks.length : ''}</span>
      </div>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} nav={nav} />
      ))}
      {onAdd && (
        <div className={styles.addRow} onClick={onAdd}>
          <span>+</span> New task
        </div>
      )}
    </div>
  )
}
