import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { RepeatRule, Task } from '../../types'
import type { AppNav } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { getListMeta, INBOX_ID, PRIO_COLOR } from '../../store/lists'
import { describeRepeat } from '../../utils/repeat'
import { Checkbox } from '../common/Checkbox'
import styles from './TaskDetailContent.module.css'

interface TaskDetailContentProps {
  task: Task
  nav: AppNav
  /**
   * Incrementing counter used by the host panel/sheet ("Edit task" menu item) to
   * put the title into inline-edit mode.
   */
  editTitleSignal?: number
}

interface RepeatPreset {
  label: string
  value: RepeatRule | null
}

const REPEAT_PRESETS: RepeatPreset[] = [
  { label: 'None', value: null },
  { label: 'Every day', value: { freq: 'daily', n: 1 } },
  { label: 'Every weekday', value: { freq: 'weekday' } },
  { label: 'Every week', value: { freq: 'weekly', n: 1 } },
  { label: 'Every other week', value: { freq: 'weekly', n: 2 } },
  { label: 'Every month', value: { freq: 'monthly', n: 1 } },
  { label: 'Every 3 months', value: { freq: 'monthly', n: 3 } },
  { label: 'Every year', value: { freq: 'yearly', n: 1 } },
]

const PRIORITIES: { key: Task['priority']; label: string }[] = [
  { key: 'low', label: 'Low' },
  { key: 'med', label: 'Med' },
  { key: 'high', label: 'High' },
]

export function TaskDetailContent({ task, nav, editTitleSignal = 0 }: TaskDetailContentProps) {
  const { projects, actions } = useAppStore()

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)

  useEffect(() => {
    if (editTitleSignal <= 0) return
    setTitleDraft(task.title)
    setEditingTitle(true)
    // Only react to the signal itself — not to later title edits.
  }, [editTitleSignal])

  const notesRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (notesRef.current && notesRef.current.textContent !== task.notes) {
      notesRef.current.textContent = task.notes
    }
    // Only resync from the store when switching to a different task — not on
    // every keystroke-triggered re-render, or the cursor would jump.
  }, [task.id])

  const [tagsDraft, setTagsDraft] = useState(task.tags.join(', '))
  useEffect(() => {
    setTagsDraft(task.tags.join(', '))
  }, [task.id])

  const [commentDraft, setCommentDraft] = useState('')

  function commitTitle() {
    const v = titleDraft.trim()
    if (v) actions.updateTask(task.id, { title: v })
    setEditingTitle(false)
  }

  function commitNotes() {
    const text = notesRef.current?.textContent ?? ''
    if (text !== task.notes) actions.updateTask(task.id, { notes: text })
  }

  function commitTags() {
    const tags = tagsDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    actions.updateTask(task.id, { tags })
  }

  const sortedProjects = [...projects].sort((a, b) => a.order - b.order)
  const listOptions = [{ id: INBOX_ID, name: 'Inbox' }, ...sortedProjects]
  const listMeta = getListMeta(task.listId, projects)

  const customRepeat: RepeatRule | null =
    task.repeat && !REPEAT_PRESETS.some((p) => JSON.stringify(p.value) === JSON.stringify(task.repeat))
      ? task.repeat
      : null

  const repeatOptions: RepeatPreset[] = customRepeat
    ? [{ label: describeRepeat(customRepeat), value: customRepeat }, ...REPEAT_PRESETS]
    : REPEAT_PRESETS

  const selectedRepeatIndex = Math.max(
    0,
    repeatOptions.findIndex((p) => JSON.stringify(p.value) === JSON.stringify(task.repeat)),
  )

  function handleRepeatChange(e: ChangeEvent<HTMLSelectElement>) {
    const idx = Number(e.target.value)
    const preset = repeatOptions[idx]
    actions.updateTask(task.id, { repeat: preset ? preset.value : null })
  }

  function handleToggleSubtask(subtaskId: string) {
    const subtask = task.subtasks.find((s) => s.id === subtaskId)
    if (!subtask) return
    const isUnchecking = subtask.done
    if (isUnchecking && task.done) {
      nav.setDialog({
        kind: 'reopen',
        body: `"${task.title}" is marked complete. Unticking a subtask will reopen it.`,
        onConfirm: () => {
          actions.toggleSubtask(task.id, subtaskId)
          actions.setDone(task.id, false)
          nav.setDialog(null)
        },
      })
      return
    }
    actions.toggleSubtask(task.id, subtaskId)
    const updatedSubtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s))
    const allNowDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.done)
    if (allNowDone && !task.done) {
      nav.setDialog({ kind: 'askDone', taskId: task.id })
    }
  }

  function handleAddSubtask(title: string) {
    if (task.done) {
      nav.setDialog({
        kind: 'reopen',
        body: `"${task.title}" is marked complete. Adding a subtask will reopen it.`,
        onConfirm: () => {
          actions.addSubtask(task.id, title)
          actions.setDone(task.id, false)
          nav.setDialog(null)
        },
      })
      return
    }
    actions.addSubtask(task.id, title)
  }

  function handleAddComment() {
    const text = commentDraft.trim()
    if (!text) return
    actions.addComment(task.id, text)
    setCommentDraft('')
  }

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.checkboxSlot}>
          <Checkbox done={task.done} onToggle={() => actions.setDone(task.id, !task.done)} size={18} />
        </div>
        <div className={styles.titleWrap}>
          {editingTitle ? (
            <input
              autoFocus
              className={styles.titleInput}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              onBlur={commitTitle}
            />
          ) : (
            <div
              className={`${styles.titleText} ${task.done ? styles.titleDone : ''}`}
              onClick={() => {
                setTitleDraft(task.title)
                setEditingTitle(true)
              }}
            >
              {task.title}
            </div>
          )}
        </div>
      </div>

      <div className={styles.propsList}>
        <div className={styles.propRow}>
          <div className={styles.propLabel}>List</div>
          <div className={styles.propValue}>
            <span className={styles.listDot} style={{ background: listMeta.dot }} />
            <select
              className={styles.select}
              value={task.listId}
              onChange={(e) => actions.updateTask(task.id, { listId: e.target.value })}
            >
              {listOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.propRow}>
          <div className={styles.propLabel}>Due</div>
          <div className={styles.propValue}>
            <div className={styles.dateTimeGroup}>
              <input
                type="date"
                className={styles.dateInput}
                value={task.dueDate ?? ''}
                onChange={(e) => actions.updateTask(task.id, { dueDate: e.target.value || null })}
              />
              <input
                type="time"
                className={styles.timeInput}
                value={task.dueTime ?? ''}
                disabled={!task.dueDate}
                onChange={(e) => actions.updateTask(task.id, { dueTime: e.target.value || null })}
              />
            </div>
          </div>
        </div>

        <div className={styles.propRow}>
          <div className={styles.propLabel}>Repeat</div>
          <div className={styles.propValue}>
            <select className={styles.select} value={String(selectedRepeatIndex)} onChange={handleRepeatChange}>
              {repeatOptions.map((opt, i) => (
                <option key={i} value={i}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.propRow}>
          <div className={styles.propLabel}>Priority</div>
          <div className={styles.propValue}>
            <div className={styles.prioRow}>
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  className={`${styles.prioPill} ${task.priority === p.key ? styles.prioPillActive : ''}`}
                  onClick={() => actions.updateTask(task.id, { priority: p.key })}
                >
                  <span className={styles.prioDot} style={{ background: PRIO_COLOR[p.key] }} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.propRow}>
          <div className={styles.propLabel}>Tags</div>
          <div className={styles.propValue}>
            <input
              className={styles.tagsInput}
              value={tagsDraft}
              placeholder="Comma-separated tags"
              onChange={(e) => setTagsDraft(e.target.value)}
              onBlur={commitTags}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitTags()
                  e.currentTarget.blur()
                }
              }}
            />
          </div>
        </div>

        <div className={styles.propRow}>
          <div className={styles.propLabel}>Assignee</div>
          <div className={styles.propValue}>
            <span className={styles.assigneeValue}>Maya Renner</span>
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      <div
        ref={notesRef}
        className={styles.notesEditable}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="No notes yet."
        onBlur={commitNotes}
      />

      <div>
        <div className={styles.sectionLabel}>
          {task.subtasks.length > 0
            ? `Subtasks ${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}`
            : 'Subtasks'}
        </div>
        {task.subtasks.map((s) => (
          <div
            className={styles.subtaskRow}
            key={s.id}
            onClick={() => handleToggleSubtask(s.id)}
          >
            <Checkbox size={15} done={s.done} onToggle={() => handleToggleSubtask(s.id)} />
            <span className={`${styles.subtaskTitle} ${s.done ? styles.subtaskDone : ''}`}>{s.title}</span>
          </div>
        ))}
        <div className={styles.addSubtaskRow}>
          <span className={styles.addSubtaskPlus}>+</span>
          <input
            key={`subtask-add-${task.id}`}
            className={styles.addSubtaskInput}
            placeholder="Add subtask"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                handleAddSubtask(e.currentTarget.value.trim())
                e.currentTarget.value = ''
              }
            }}
          />
        </div>
      </div>

      <div className={styles.dividerComments} />

      <div>
        {task.comments.map((c) => (
          <div className={styles.commentRow} key={c.id}>
            <div className={styles.avatar}>{c.init}</div>
            <div className={styles.commentBody}>
              <div className={styles.commentMeta}>
                <span className={styles.commentWho}>{c.who}</span>
                <span className={styles.commentWhen}>{c.when}</span>
              </div>
              <div className={styles.commentText}>{c.text}</div>
            </div>
          </div>
        ))}
        <div className={styles.addCommentRow}>
          <div className={styles.avatar}>M</div>
          <input
            className={styles.addCommentInput}
            placeholder="Add a comment…"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddComment()
            }}
          />
        </div>
      </div>
    </div>
  )
}
