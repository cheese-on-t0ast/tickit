import { useEffect } from 'react'

export interface Shortcut {
  key: string
  /** Require Cmd (Mac) or Ctrl (elsewhere). */
  mod?: boolean
  handler: (e: KeyboardEvent) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      for (const s of shortcuts) {
        if (e.key.toLowerCase() !== s.key.toLowerCase()) continue
        if (s.mod && !(e.metaKey || e.ctrlKey)) continue
        if (!s.mod && s.key !== 'Escape' && isTypingTarget(e.target)) continue
        e.preventDefault()
        s.handler(e)
        break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [shortcuts])
}
