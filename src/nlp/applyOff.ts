import type { ParsedCapture } from '../types'

/** Off-keys the user dismissed by hovering a parsed-value chip and clicking
 * its X — mirrors the mockup's `off`/`applyOff`. Persists across re-parses of
 * the same capture session until the field is cleared. */
export function applyOff(parsed: ParsedCapture | null, off: Record<string, boolean>): ParsedCapture | null {
  if (!parsed) return null
  const result: ParsedCapture = { ...parsed }
  if (off.date) {
    result.dueDate = null
    result.dueTime = null
    result.label = ''
    result.dated = false
    result.group = 'later'
  }
  if (off.list) {
    result.listId = 'inbox'
    result.listGiven = false
  }
  if (off.prio) {
    result.priority = 'low'
  }
  if (off.repeat) {
    result.repeat = null
  }
  result.tags = result.tags.filter((t) => !off[`tag:${t}`])
  return result
}
