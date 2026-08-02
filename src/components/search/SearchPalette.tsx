import { useState } from 'react'
import type { AppNav } from '../../hooks/useAppNav'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useAppStore } from '../../store/AppStore'
import { getListMeta } from '../../store/lists'
import shared from '../../styles/shared.module.css'
import type { Task } from '../../types'
import { dueDateLabel, formatTime12, todayISO } from '../../utils/date'
import styles from './SearchPalette.module.css'

interface SearchPaletteProps {
  nav: AppNav
}

export function SearchPalette({ nav }: SearchPaletteProps) {
  const { tasks, projects } = useAppStore()
  const [query, setQuery] = useState('')

  useKeyboardShortcuts([{ key: 'Escape', handler: () => nav.closeSearch() }])

  const trimmed = query.trim()
  const results = trimmed === ''
    ? tasks.filter((t) => !t.done).slice(0, 5)
    : tasks.filter((t) => t.title.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 7)

  const today = todayISO()

  function renderRow(task: Task) {
    const meta = getListMeta(task.listId, projects)
    return (
      <div
        key={task.id}
        className={styles.row}
        onClick={() => {
          nav.closeSearch()
          nav.openDetail(task.id)
        }}
      >
        <span className={shared.dot} style={{ background: meta.dot }} />
        <span className={styles.title}>{task.title}</span>
        <span className={styles.listName}>{meta.name}</span>
        {task.dueDate && (
          <span className={styles.due}>
            {dueDateLabel(task.dueDate, today)}
            {task.dueTime ? ` · ${formatTime12(task.dueTime)}` : ''}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={styles.backdrop} onClick={() => nav.closeSearch()}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchRow}>
          <input
            autoFocus
            className={styles.input}
            placeholder="Search tasks, lists and notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className={styles.escHint}>esc</span>
        </div>
        <div className={styles.results} data-scroll>
          {trimmed === '' ? (
            <>
              <div className={styles.sectionLabel}>Recent</div>
              {results.map(renderRow)}
            </>
          ) : results.length > 0 ? (
            <>
              <div className={styles.sectionLabel}>Results</div>
              {results.map(renderRow)}
            </>
          ) : (
            <div
              className={styles.fallback}
              onClick={() => {
                nav.closeSearch()
                nav.openQuick({ initialText: query })
              }}
            >
              No matches — capture &quot;{query}&quot; as a new task
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
