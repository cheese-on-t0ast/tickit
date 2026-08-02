import type { AppNav } from '../../hooks/useAppNav'
import { TaskListView } from '../tasks/TaskListView'
import { CalendarView } from '../calendar/CalendarView'
import { SettingsView } from '../settings/SettingsView'
import { TaskDetailPanel } from '../detail/TaskDetailPanel'
import { QuickCaptureModal } from '../capture/QuickCaptureModal'
import { SearchPalette } from '../search/SearchPalette'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import styles from './DesktopShell.module.css'

interface DesktopShellProps {
  nav: AppNav
}

function ShellContent({ nav }: DesktopShellProps) {
  if (nav.view.kind === 'calendar') {
    return <CalendarView nav={nav} />
  }
  if (nav.view.kind === 'settings') {
    return <SettingsView nav={nav} />
  }
  return <TaskListView view={nav.view} nav={nav} />
}

export function DesktopShell({ nav }: DesktopShellProps) {
  return (
    <div className={styles.shell}>
      <Sidebar nav={nav} />
      <div className={styles.main}>
        <TopBar nav={nav} />
        <div className={styles.content}>
          <ShellContent nav={nav} />
        </div>
      </div>

      {nav.selectedTaskId && (
        <div className={`${styles.overlay} ${styles.overlayDetail}`}>
          <TaskDetailPanel taskId={nav.selectedTaskId} nav={nav} />
        </div>
      )}
      {nav.quickOpen && (
        <div className={`${styles.overlay} ${styles.overlayQuick}`}>
          <QuickCaptureModal nav={nav} />
        </div>
      )}
      {nav.searchOpen && (
        <div className={`${styles.overlay} ${styles.overlaySearch}`}>
          <SearchPalette nav={nav} />
        </div>
      )}
    </div>
  )
}
