import { useEffect } from 'react'
import { AppStoreProvider, useAppStore } from './store/AppStore'
import { useAppNav } from './hooks/useAppNav'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useResolvedTheme } from './hooks/useResolvedTheme'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { DesktopShell } from './components/layout/DesktopShell'
import { MobileShell } from './components/layout/MobileShell'
import { ConfirmDialog } from './components/dialogs/ConfirmDialog'
import { ReopenDialog } from './components/dialogs/ReopenDialog'
import { AskDoneDialog } from './components/dialogs/AskDoneDialog'

function AppShell() {
  const { settings, actions } = useAppStore()
  const nav = useAppNav()
  const isDesktop = useMediaQuery('(min-width: 860px)')
  const resolvedTheme = useResolvedTheme(settings.appearance)

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
  }, [resolvedTheme])

  useKeyboardShortcuts([
    { key: 'k', mod: true, handler: () => nav.openSearch() },
    { key: 'n', handler: () => nav.openQuick() },
    {
      key: 't',
      handler: () => {
        if (nav.selectedTaskId) actions.bumpTomorrow(nav.selectedTaskId)
      },
    },
    {
      key: 'Escape',
      handler: () => {
        if (nav.dialog) nav.setDialog(null)
        else if (nav.searchOpen) nav.closeSearch()
        else if (nav.quickOpen) nav.closeQuick()
        else if (nav.selectedTaskId) nav.closeDetail()
        else if (nav.helpOpen) nav.closeHelp()
      },
    },
  ])

  return (
    <div className="tickit-root" style={{ height: '100%' }}>
      {isDesktop ? <DesktopShell nav={nav} /> : <MobileShell nav={nav} />}
      <ConfirmDialog nav={nav} />
      <ReopenDialog nav={nav} />
      <AskDoneDialog nav={nav} />
    </div>
  )
}

export default function App() {
  return (
    <AppStoreProvider>
      <AppShell />
    </AppStoreProvider>
  )
}
