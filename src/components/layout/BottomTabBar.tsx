import { Icon, type IconName } from '../common/Icon'
import styles from './BottomTabBar.module.css'

export type MobileTab = 'today' | 'lists' | 'calendar' | 'settings'

interface BottomTabBarProps {
  active: MobileTab
  onSelect: (tab: MobileTab) => void
}

const TABS: { tab: MobileTab; icon: IconName; label: string }[] = [
  { tab: 'today', icon: 'today', label: 'Today' },
  { tab: 'lists', icon: 'list', label: 'Lists' },
  { tab: 'calendar', icon: 'calendar', label: 'Calendar' },
  { tab: 'settings', icon: 'settings', label: 'Settings' },
]

export function BottomTabBar({ active, onSelect }: BottomTabBarProps) {
  return (
    <nav className={styles.bar}>
      {TABS.map(({ tab, icon, label }) => {
        const isActive = active === tab
        return (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            onClick={() => onSelect(tab)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon name={icon} size={21} strokeWidth={1.8} />
            <span className={styles.label}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
