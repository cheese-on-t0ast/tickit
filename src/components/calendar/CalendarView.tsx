import { useState } from 'react'
import type { AppNav } from '../../hooks/useAppNav'
import { useAppStore } from '../../store/AppStore'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useResolvedTheme } from '../../hooks/useResolvedTheme'
import { getChipColors, getListMeta } from '../../store/lists'
import { addDays, formatTime12, isSameMonth, toISODate, todayISO, weekStartOf } from '../../utils/date'
import styles from './CalendarView.module.css'

interface CalendarViewProps {
  nav: AppNav
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAY_LETTERS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_LETTERS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MOBILE_WEEKDAY_LETTERS_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MOBILE_WEEKDAY_LETTERS_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface DayCell {
  iso: string
  day: number
  inMonth: boolean
  isToday: boolean
}

export function CalendarView({ nav }: CalendarViewProps) {
  const { tasks, projects, settings } = useAppStore()
  const isDesktop = useMediaQuery('(min-width: 860px)')
  const dark = useResolvedTheme(settings.appearance) === 'dark'

  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [selectedDay, setSelectedDay] = useState(todayISO())

  function goToday() {
    const n = new Date()
    setCursor({ year: n.getFullYear(), month: n.getMonth() })
    if (!isDesktop) setSelectedDay(todayISO())
  }

  function stepMonth(delta: number) {
    setCursor((c) => {
      let month = c.month + delta
      let year = c.year
      if (month < 0) {
        month = 11
        year -= 1
      } else if (month > 11) {
        month = 0
        year += 1
      }
      return { year, month }
    })
  }

  const weekdayLabels = isDesktop
    ? settings.weekStart === 'mon' ? WEEKDAY_LETTERS_MON : WEEKDAY_LETTERS_SUN
    : settings.weekStart === 'mon' ? MOBILE_WEEKDAY_LETTERS_MON : MOBILE_WEEKDAY_LETTERS_SUN

  // First day of the displayed month, then the weekStart-aligned start of that week.
  const firstOfMonthIso = toISODate(new Date(cursor.year, cursor.month, 1))
  const gridStart = weekStartOf(firstOfMonthIso, settings.weekStart)

  const todayIso = todayISO()
  const cells: DayCell[] = []
  for (let i = 0; i < 35; i++) {
    const iso = addDays(gridStart, i)
    const d = new Date(iso + 'T00:00:00')
    cells.push({
      iso,
      day: d.getDate(),
      inMonth: isSameMonth(iso, cursor.year, cursor.month),
      isToday: iso === todayIso,
    })
  }

  const tasksByDay = (iso: string) => tasks.filter((t) => t.dueDate === iso)

  function cellBg(cell: DayCell): string {
    if (cell.isToday) return isDesktop ? 'rgba(74,127,174,.05)' : 'var(--tk-accent)'
    if (!cell.inMonth) return 'rgba(var(--fgc),.018)'
    return 'transparent'
  }

  const selectedTasks = tasksByDay(selectedDay)
  const selectedDate = new Date(selectedDay + 'T00:00:00')
  const selectedLabel = `${WEEKDAY_FULL[selectedDate.getDay()]} ${selectedDate.getDate()}`

  return (
    <div className={styles.root} data-desktop={isDesktop}>
      <div className={styles.header}>
        <h1 className={styles.monthLabel}>
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </h1>
        <div className={styles.navGroup}>
          <button type="button" className={styles.navButton} onClick={() => stepMonth(-1)} aria-label="Previous month">
            ‹
          </button>
          <button type="button" className={styles.navButton} onClick={() => stepMonth(1)} aria-label="Next month">
            ›
          </button>
        </div>
        <button type="button" className={styles.todayLink} onClick={goToday}>
          Today
        </button>
        <div className={styles.segmented}>
          <span className={styles.segment}>Week</span>
          <span className={`${styles.segment} ${styles.segmentActive}`}>Month</span>
        </div>
      </div>

      <div className={styles.weekdayRow}>
        {weekdayLabels.map((label, i) => (
          <div key={`${label}-${i}`} className={styles.weekdayCell}>
            {label}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {cells.map((cell) => {
          const dayTasks = tasksByDay(cell.iso)
          return (
            <div
              key={cell.iso}
              className={styles.cell}
              style={{ background: cellBg(cell) }}
              data-selected={!isDesktop && cell.iso === selectedDay}
              onClick={() => {
                if (!isDesktop) setSelectedDay(cell.iso)
              }}
            >
              <div className={styles.cellHead}>
                <span
                  className={styles.dayNumber}
                  data-today={cell.isToday}
                  data-dim={!cell.inMonth}
                >
                  {cell.day}
                </span>
              </div>

              {isDesktop ? (
                <div className={styles.chipList}>
                  {dayTasks.map((task) => {
                    const chip = getChipColors(task.listId, getListMeta(task.listId, projects).dot, dark)
                    return (
                      <div
                        key={task.id}
                        className={styles.chip}
                        style={{ background: chip.bg, color: chip.fg }}
                        data-done={task.done}
                        onClick={(e) => {
                          e.stopPropagation()
                          nav.openDetail(task.id)
                        }}
                        title={task.title}
                      >
                        {task.title}
                      </div>
                    )
                  })}
                </div>
              ) : (
                dayTasks.length > 0 && (
                  <span
                    className={styles.dayDot}
                    style={{ background: getListMeta(dayTasks[0].listId, projects).dot }}
                  />
                )
              )}
            </div>
          )
        })}
      </div>

      {!isDesktop && (
        <div className={styles.agenda} data-scroll>
          <div className={styles.agendaHeader}>{selectedLabel}</div>
          {selectedTasks.length === 0 ? (
            <div className={styles.agendaEmpty}>Nothing scheduled</div>
          ) : (
            <div className={styles.agendaList}>
              {selectedTasks.map((task) => {
                const dot = getListMeta(task.listId, projects).dot
                return (
                  <div
                    key={task.id}
                    className={styles.agendaRow}
                    onClick={() => nav.openDetail(task.id)}
                  >
                    <span className={styles.agendaTime}>
                      {task.dueTime ? formatTime12(task.dueTime) : ''}
                    </span>
                    <span className={styles.agendaBar} style={{ background: dot }} />
                    <span className={styles.agendaTitle} data-done={task.done}>
                      {task.title}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
