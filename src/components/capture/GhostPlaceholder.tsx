import { useEffect, useRef, useState } from 'react'
import styles from './GhostPlaceholder.module.css'

const PLACEHOLDERS = [
  'What needs doing?',
  'Cancel Claude subscription tomorrow',
  'Book car in for maintenance next Tuesday',
  'Send invoice on the 15th of every month',
  'Standup every weekday 9am #product',
  'Renew passport in 10 days !!',
]

const TYPE_MS = 40
const DELETE_MS = 24
const FIRST_HOLD_MS = 3200
const HOLD_MS = 4400

/** Decorative, ever-cycling "type then delete" placeholder shown behind the quick-capture input. */
export function GhostPlaceholder() {
  const [display, setDisplay] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    let phraseIndex = 0

    function schedule(fn: () => void, ms: number) {
      timerRef.current = setTimeout(() => {
        if (!cancelled) fn()
      }, ms)
    }

    function typePhrase(charIndex: number) {
      const phrase = PLACEHOLDERS[phraseIndex]
      setDisplay(phrase.slice(0, charIndex))
      if (charIndex < phrase.length) {
        schedule(() => typePhrase(charIndex + 1), TYPE_MS)
      } else {
        const holdMs = phraseIndex === 0 ? FIRST_HOLD_MS : HOLD_MS
        schedule(() => deletePhrase(phrase.length), holdMs)
      }
    }

    function deletePhrase(charIndex: number) {
      const phrase = PLACEHOLDERS[phraseIndex]
      setDisplay(phrase.slice(0, charIndex))
      if (charIndex > 0) {
        schedule(() => deletePhrase(charIndex - 1), DELETE_MS)
      } else {
        phraseIndex = (phraseIndex + 1) % PLACEHOLDERS.length
        schedule(() => typePhrase(0), TYPE_MS)
      }
    }

    typePhrase(0)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <span className={styles.wrap} aria-hidden="true">
      {display}
      <span className={styles.caret} />
    </span>
  )
}
