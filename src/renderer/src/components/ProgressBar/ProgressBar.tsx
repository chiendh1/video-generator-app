import { RefObject } from 'react'
import styles from './ProgressBar.module.css'

interface Props {
  currentTime: number
  duration: number
  audioRef: RefObject<HTMLAudioElement | null>
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function ProgressBar({ currentTime, duration, audioRef }: Props): React.JSX.Element {
  const pct = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0

  const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = ratio * duration
  }

  return (
    <div className={styles.root}>
      <div className={styles.timeRow}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className={styles.track} onClick={handleClick}>
        <div className={styles.fill} style={{ width: `${pct}%` }}>
          <div className={styles.thumb} />
        </div>
      </div>
    </div>
  )
}
