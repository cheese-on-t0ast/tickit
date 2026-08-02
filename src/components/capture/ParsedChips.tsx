import { useState, type ReactNode } from 'react'
import type { ParsedCapture } from '../../types'
import { useAppStore } from '../../store/AppStore'
import { useResolvedTheme } from '../../hooks/useResolvedTheme'
import { getChipColors, getListMeta, PRIO_COLOR } from '../../store/lists'
import { formatTime12 } from '../../utils/date'
import { describeRepeat } from '../../utils/repeat'
import shared from '../../styles/shared.module.css'
import styles from './ParsedChips.module.css'

interface ParsedChipsProps {
  parsed: ParsedCapture | null
  dismiss: (key: string) => void
  /** Mobile chips are pills with an always-visible dismiss badge; desktop
   * chips only reveal dismiss on hover. */
  variant?: 'desktop' | 'mobile'
}

interface ChipSpec {
  key: string | null
  label: string
  content: ReactNode
  bg: string
  fg: string
  border: string
}

export function ParsedChips({ parsed, dismiss, variant = 'desktop' }: ParsedChipsProps) {
  const { projects, settings } = useAppStore()
  const dark = useResolvedTheme(settings.appearance) === 'dark'
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  if (!parsed) return null

  const soft = dark ? 'rgba(var(--fgc),.1)' : 'rgba(var(--fgc),.05)'
  const hasDate = parsed.dated || !!parsed.dueTime
  const listMeta = getListMeta(parsed.listId, projects)
  const listChip = getChipColors(parsed.listId, listMeta.dot, dark)

  const chips: ChipSpec[] = []

  chips.push(
    hasDate
      ? {
          key: 'date',
          label: 'date',
          content: `${parsed.label || 'Today'}${parsed.dueTime ? ` · ${formatTime12(parsed.dueTime)}` : ''}`,
          bg: dark ? 'rgba(255,255,255,.13)' : 'rgba(var(--fgc),.08)',
          fg: 'var(--fg)',
          border: 'transparent',
        }
      : {
          key: null,
          label: 'date',
          content: 'No date',
          bg: 'transparent',
          fg: 'rgba(var(--fgc),.5)',
          border: 'rgba(var(--fgc),.14)',
        },
  )

  chips.push({
    key: parsed.listGiven ? 'list' : null,
    label: 'list',
    content: (
      <>
        <span className={styles.chipDot} style={{ background: listMeta.dot }} />
        {listMeta.name}
      </>
    ),
    bg: listChip.bg,
    fg: listChip.fg,
    border: 'transparent',
  })

  if (parsed.repeat) {
    chips.push({
      key: 'repeat',
      label: 'recurrence',
      content: `↻ ${describeRepeat(parsed.repeat)}`,
      bg: soft,
      fg: 'rgba(var(--fgc),.62)',
      border: 'transparent',
    })
  }

  if (parsed.priority !== 'low') {
    chips.push({
      key: 'prio',
      label: 'priority',
      content: (
        <>
          <span className={styles.chipDot} style={{ background: PRIO_COLOR[parsed.priority] }} />
          {parsed.priority === 'high' ? 'High' : 'Medium'}
        </>
      ),
      bg: soft,
      fg: 'rgba(var(--fgc),.62)',
      border: 'transparent',
    })
  }

  for (const tag of parsed.tags) {
    chips.push({
      key: `tag:${tag}`,
      label: 'tag',
      content: `#${tag}`,
      bg: soft,
      fg: 'rgba(var(--fgc),.62)',
      border: 'transparent',
    })
  }

  return (
    <>
      {chips.map((chip, i) => {
        const base = chip.key ? `${shared.chip} ${styles.chip}` : `${shared.chip} ${styles.chip} ${styles.dimmed}`
        const showDismiss = !!chip.key && (variant === 'mobile' || hoveredKey === chip.key)
        return (
          <span
            key={chip.key ?? `plain-${i}`}
            className={variant === 'mobile' ? `${base} ${styles.mobileChip}` : base}
            style={{ background: chip.bg, color: chip.fg, borderColor: chip.border }}
            onMouseEnter={() => chip.key && setHoveredKey(chip.key)}
            onMouseLeave={() => setHoveredKey((k) => (k === chip.key ? null : k))}
          >
            {chip.content}
            {showDismiss && chip.key && (
              <span
                className={variant === 'mobile' ? styles.mobileDismiss : styles.dismiss}
                onClick={(e) => {
                  e.stopPropagation()
                  dismiss(chip.key!)
                }}
                title={`Ignore this ${chip.label}`}
              >
                ✕
              </span>
            )}
          </span>
        )
      })}
    </>
  )
}
