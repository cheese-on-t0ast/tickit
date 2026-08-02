import type { AppNav } from '../../hooks/useAppNav'
import { useQuickCapture } from '../../hooks/useQuickCapture'
import { useAppStore } from '../../store/AppStore'
import { getListMeta } from '../../store/lists'
import { formatTime12 } from '../../utils/date'
import { describeRepeat } from '../../utils/repeat'
import type { ParsedCapture, Project } from '../../types'
import { ParsedChips } from './ParsedChips'
import { GhostPlaceholder } from './GhostPlaceholder'
import shared from '../../styles/shared.module.css'
import styles from './QuickCaptureModal.module.css'

function buildHint(text: string, parsed: ParsedCapture | null, projects: Project[]): string {
  if (text.trim() === '') {
    return 'Write it how you\'d say it — "pay rent on the 1st", "standup tomorrow 9am", "#design polish next tue"'
  }
  if (!parsed) return 'Reading…'

  const dateClause = parsed.dated ? parsed.label || 'Today' : 'No date'
  const timeClause = parsed.dueTime ? formatTime12(parsed.dueTime) : null
  const listClause = parsed.listGiven ? getListMeta(parsed.listId, projects).name : null
  const repeatClause = parsed.repeat ? `repeats ${describeRepeat(parsed.repeat).toLowerCase()}` : null
  const priorityClause = parsed.priority !== 'low' ? (parsed.priority === 'high' ? 'High priority' : 'Medium priority') : null

  const clauses = [dateClause, timeClause, listClause, repeatClause, priorityClause].filter(Boolean)
  return `Reading it as ${clauses.join(' · ')}`
}

interface QuickCaptureModalProps {
  nav: AppNav
}

export function QuickCaptureModal({ nav }: QuickCaptureModalProps) {
  const { projects } = useAppStore()
  const { text, setText, parsed, dismiss, submit } = useQuickCapture({
    defaultListId: nav.quickDefaultListId ?? undefined,
    initialText: nav.quickInitialText ?? undefined,
  })

  const hint = buildHint(text, parsed, projects)

  return (
    <div className={styles.backdrop} onClick={() => nav.closeQuick()}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <div className={styles.decorativeBox} />
          <div className={styles.inputWrap}>
            {text === '' && <GhostPlaceholder />}
            <input
              className={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  submit()
                  nav.closeQuick()
                } else if (e.key === 'Escape') {
                  nav.closeQuick()
                }
              }}
              autoFocus
              style={{ position: 'relative', zIndex: 1, background: 'transparent' }}
            />
          </div>
        </div>

        <div className={styles.chipsRow}>
          <ParsedChips parsed={parsed} dismiss={dismiss} />
          {parsed?.title && <span className={styles.savesAs}>saves as &quot;{parsed.title}&quot;</span>}
        </div>

        <div className={styles.footer}>
          <span className={styles.hint}>{hint}</span>
          <button
            type="button"
            className={shared.accentButton}
            style={{ background: 'var(--tk-accent)' }}
            onClick={() => {
              submit()
              nav.closeQuick()
            }}
          >
            Add <span className={styles.enterGlyph}>↵</span>
          </button>
        </div>
      </div>
    </div>
  )
}
