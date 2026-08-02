import type { AppNav } from '../../hooks/useAppNav'
import { TICKIT_VERSION } from '../../version'
import styles from './HelpPopover.module.css'

interface HelpPopoverProps {
  nav: AppNav
}

interface CaptureTip {
  examples: string[]
  desc: string
}

const CAPTURE_TIPS: CaptureTip[] = [
  {
    examples: ['tomorrow', 'next friday', 'in a few days', 'end of the month', 'eod'],
    desc: 'sets a due date',
  },
  {
    examples: [
      'every month',
      'once a week',
      'every other thursday',
      'first monday of the month',
    ],
    desc: 'sets a recurring schedule — only the next occurrence ever shows',
  },
  { examples: ['!!', 'urgent'], desc: 'high priority' },
  { examples: ['!', 'important'], desc: 'medium priority' },
  { examples: ['#design'], desc: 'adds a tag' },
  { examples: ['for design', '@design', 'in design'], desc: 'files it straight into a project' },
]

const GETTING_STARTED: string[] = [
  'Today rolls up anything overdue alongside what’s due today.',
  'Lists live in the sidebar — click + to start a new one.',
  'Hover a task (or swipe it on mobile) for quick actions: bump, edit, delete.',
  'Ticking every subtask offers to close out the parent task for you.',
]

const SHORTCUT_ROWS: { label: string; key: string }[] = [
  { label: 'Search everything', key: '⌘K' },
  { label: 'New task', key: 'N' },
  { label: 'Bump the open task to tomorrow', key: 'T' },
  { label: 'Close the topmost panel', key: 'esc' },
  { label: 'Add a task from quick capture', key: '⏎' },
  { label: 'Dismiss a misread chip', key: 'hover + ✕' },
]

export function HelpPopover({ nav }: HelpPopoverProps) {
  return (
    <div className={styles.backdrop} onClick={() => nav.closeHelp()}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.title}>Help &amp; shortcuts</div>

        <div className={styles.scrollBody} data-scroll>
          <div className={styles.sectionLabel}>Quick capture reads</div>
          {CAPTURE_TIPS.map((tip) => (
            <div className={styles.tipRow} key={tip.desc}>
              <div className={styles.tipExamples}>
                {tip.examples.map((ex) => (
                  <span className={styles.exampleChip} key={ex}>
                    {ex}
                  </span>
                ))}
              </div>
              <div className={styles.tipDesc}>{tip.desc}</div>
            </div>
          ))}

          <div className={styles.divider} />
          <div className={styles.sectionLabel}>Getting started</div>
          {GETTING_STARTED.map((tip) => (
            <div className={styles.blurbRow} key={tip}>
              {tip}
            </div>
          ))}

          <div className={styles.divider} />
          <div className={styles.sectionLabel}>Shortcuts</div>
          {SHORTCUT_ROWS.map((row) => (
            <div className={styles.shortcutRow} key={row.label}>
              <span className={styles.shortcutLabel}>{row.label}</span>
              <span className={styles.keyBadge}>{row.key}</span>
            </div>
          ))}
        </div>

        <div className={styles.footer}>tickit {TICKIT_VERSION}</div>
      </div>
    </div>
  )
}
