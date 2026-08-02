import type { AppNav } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import type { Appearance } from '../../types'
import styles from './SettingsView.module.css'

interface SettingsViewProps {
  nav: AppNav
}

const NEXT_APPEARANCE: Record<Appearance, Appearance> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function ToggleRow({
  label,
  desc,
  value,
  onToggle,
}: {
  label: string
  desc: string
  value: boolean
  onToggle: () => void
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <div className={styles.switchTrack} data-on={value} onClick={onToggle}>
        <div className={styles.switchKnob} />
      </div>
    </div>
  )
}

function ValueRow({
  label,
  desc,
  value,
  onClick,
  isDesktop,
}: {
  label: string
  desc: string
  value: string
  onClick: () => void
  isDesktop: boolean
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowLabel}>{label}</div>
        {desc && <div className={styles.rowDesc}>{desc}</div>}
      </div>
      {isDesktop ? (
        <div className={styles.pill} onClick={onClick}>
          {value} ⌄
        </div>
      ) : (
        <div className={styles.mobileValue} onClick={onClick}>
          {value} ›
        </div>
      )}
    </div>
  )
}

export function SettingsView({ nav: _nav }: SettingsViewProps) {
  const { settings, actions } = useAppStore()
  const isDesktop = useMediaQuery('(min-width: 860px)')

  return (
    <div className={styles.root} data-scroll>
      <div className={styles.inner}>
        <h1 className={styles.heading}>Settings</h1>

        {!isDesktop && (
          <div className={styles.profileRow}>
            <div className={styles.avatar}>M</div>
            <div className={styles.profileText}>
              <div className={styles.profileName}>Maya Renner</div>
              <div className={styles.profileMeta}>maya@tickit.app · Free plan</div>
            </div>
          </div>
        )}

        <section className={styles.section}>
          <div className={styles.sectionLabel}>Tasks</div>
          <ToggleRow
            label="Roll overdue tasks into Today"
            desc="Off keeps them in a separate Overdue group, so you notice the slip."
            value={settings.rollover}
            onToggle={() => actions.updateSettings({ rollover: !settings.rollover })}
          />
          <ToggleRow
            label="Show completed tasks in lists"
            desc="They stay searchable either way."
            value={settings.showDone}
            onToggle={() => actions.updateSettings({ showDone: !settings.showDone })}
          />
          <ValueRow
            label="Week starts on"
            desc="Affects the calendar grid and week view."
            value={settings.weekStart === 'mon' ? 'Monday' : 'Sunday'}
            onClick={() => actions.updateSettings({ weekStart: settings.weekStart === 'mon' ? 'sun' : 'mon' })}
            isDesktop={isDesktop}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>Notifications</div>
          <ToggleRow
            label="Daily plan at 8:45am"
            desc="One notification with today's list. Never more than one."
            value={settings.reminders}
            onToggle={() => actions.updateSettings({ reminders: !settings.reminders })}
          />
          <ToggleRow
            label="Badge count on the app icon"
            desc="Counts overdue and today only."
            value={settings.badge}
            onToggle={() => actions.updateSettings({ badge: !settings.badge })}
          />
          <ToggleRow
            label="Haptics on complete"
            desc="A light tap when you finish a task."
            value={settings.haptics}
            onToggle={() => actions.updateSettings({ haptics: !settings.haptics })}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>Appearance</div>
          <ValueRow
            label="Theme"
            desc="Light, dark, or match your system."
            value={capitalize(settings.appearance)}
            onClick={() => actions.updateSettings({ appearance: NEXT_APPEARANCE[settings.appearance] })}
            isDesktop={isDesktop}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionLabel}>Account</div>
          <ValueRow
            label="Plan"
            desc="Free — unlimited tasks, three projects."
            value="Free"
            onClick={() => {}}
            isDesktop={isDesktop}
          />
          <ValueRow
            label="Export"
            desc="Download everything as Markdown or CSV."
            value="Markdown"
            onClick={() => {}}
            isDesktop={isDesktop}
          />
        </section>
      </div>
    </div>
  )
}
