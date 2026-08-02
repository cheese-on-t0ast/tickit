import { useEffect, useMemo, useState } from 'react'
import type { ParsedCapture, Task } from '../types'
import { useAppStore } from '../store/AppStore'
import { initNlp, parseCapture } from '../nlp/parseCapture'
import { applyOff } from '../nlp/applyOff'
import { newId } from '../store/id'
import { INBOX_ID } from '../store/lists'

interface UseQuickCaptureOptions {
  defaultListId?: string | null
  initialText?: string | null
}

export function useQuickCapture(opts: UseQuickCaptureOptions = {}) {
  const { projects, actions } = useAppStore()
  const [text, setText] = useState(opts.initialText ?? '')
  const [off, setOff] = useState<Record<string, boolean>>({})
  const [raw, setRaw] = useState<ParsedCapture | null>(null)
  const [nlpReady, setNlpReady] = useState(false)

  const knownListIds = useMemo(() => [INBOX_ID, ...projects.map((p) => p.id)], [projects])

  useEffect(() => {
    let cancelled = false
    initNlp().then(() => {
      if (!cancelled) setNlpReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!nlpReady) return
    if (!text.trim()) {
      setRaw(null)
      return
    }
    setRaw(parseCapture(text, new Date(), knownListIds))
  }, [text, knownListIds, nlpReady])

  const parsed = useMemo<ParsedCapture | null>(() => {
    const applied = applyOff(raw, off)
    if (!applied) return applied
    if (opts.defaultListId && !applied.listGiven && !off.list) {
      return { ...applied, listId: opts.defaultListId }
    }
    return applied
  }, [raw, off, opts.defaultListId])

  function dismiss(key: string) {
    setOff((o) => ({ ...o, [key]: true }))
  }

  function reset() {
    setText('')
    setOff({})
    setRaw(null)
  }

  function submit(): Task | null {
    if (!parsed || !parsed.title.trim()) return null
    const now = new Date().toISOString()
    const task: Task = {
      id: newId(),
      title: parsed.title,
      listId: parsed.listId,
      done: false,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      priority: parsed.priority,
      tags: parsed.tags,
      notes: `Captured from "${text.trim()}".`,
      subtasks: [],
      comments: [],
      repeat: parsed.repeat,
      group: parsed.group,
      createdAt: now,
      updatedAt: now,
    }
    actions.addTask(task)
    reset()
    return task
  }

  return { text, setText, parsed, dismiss, reset, submit, nlpReady }
}
