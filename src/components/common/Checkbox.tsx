import styles from './Checkbox.module.css'

interface CheckboxProps {
  done: boolean
  onToggle: () => void
  size?: number
  title?: string
}

export function Checkbox({ done, onToggle, size = 16, title }: CheckboxProps) {
  return (
    <button
      type="button"
      className={styles.box}
      data-done={done}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      style={{ width: size, height: size }}
    >
      {done && <span className={styles.check} style={{ fontSize: size * 0.62 }}>✓</span>}
    </button>
  )
}
