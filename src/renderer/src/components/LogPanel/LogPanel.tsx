import { useEffect, useRef } from 'react'
import { LogLine } from '../../types'
import styles from './LogPanel.module.css'

interface Props {
  logs: LogLine[]
  onClear: () => void
}

const STEP_LABEL: Record<LogLine['step'], string> = { srt: 'SRT', mp4: 'MP4', system: 'SYS' }

export function LogPanel({ logs, onClear }: Props): React.JSX.Element | null {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  if (logs.length === 0) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>Log</span>
        <button className={styles.clearBtn} onClick={onClear}>
          Clear
        </button>
      </div>
      <div className={styles.body} ref={bodyRef}>
        {logs.map((line) => (
          <div
            key={line.id}
            className={`${styles.line} ${line.level === 'error' ? styles.errorLine : ''}`}
          >
            <span className={`${styles.chip} ${styles[`chip_${line.step}`]}`}>
              {STEP_LABEL[line.step]}
            </span>
            <span className={styles.msg}>{line.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
