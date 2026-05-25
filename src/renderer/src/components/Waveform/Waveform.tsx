import styles from './Waveform.module.css'

const BARS: Array<{ h: number; delay: number; color: string; dur: number }> = [
  { h: 35, delay: 0.0, color: '#ef9f27', dur: 0.9 },
  { h: 55, delay: 0.1, color: '#14b8a6', dur: 1.1 },
  { h: 70, delay: 0.2, color: '#6366f1', dur: 0.82 },
  { h: 48, delay: 0.05, color: '#ef9f27', dur: 1.2 },
  { h: 82, delay: 0.15, color: '#14b8a6', dur: 0.95 },
  { h: 60, delay: 0.25, color: '#f43f5e', dur: 0.85 },
  { h: 42, delay: 0.3, color: '#6366f1', dur: 1.05 },
  { h: 90, delay: 0.08, color: '#ef9f27', dur: 1.15 },
  { h: 52, delay: 0.18, color: '#14b8a6', dur: 0.92 },
  { h: 67, delay: 0.12, color: '#6366f1', dur: 1.08 },
  { h: 75, delay: 0.22, color: '#ef9f27', dur: 0.88 },
  { h: 58, delay: 0.32, color: '#14b8a6', dur: 1.18 },
  { h: 85, delay: 0.06, color: '#f43f5e', dur: 0.98 },
  { h: 45, delay: 0.16, color: '#6366f1', dur: 1.02 },
  { h: 72, delay: 0.26, color: '#ef9f27', dur: 0.93 },
  { h: 62, delay: 0.36, color: '#14b8a6', dur: 1.07 },
  { h: 50, delay: 0.04, color: '#6366f1', dur: 0.87 },
  { h: 80, delay: 0.14, color: '#ef9f27', dur: 1.13 },
  { h: 38, delay: 0.24, color: '#f43f5e', dur: 0.97 },
  { h: 65, delay: 0.34, color: '#14b8a6', dur: 1.03 }
]

export function Waveform(): React.JSX.Element {
  return (
    <div className={styles.root}>
      {BARS.map((bar, i) => (
        <div
          key={i}
          className={styles.bar}
          style={
            {
              height: `${bar.h}px`,
              background: bar.color,
              '--delay': `${bar.delay}s`,
              '--dur': `${bar.dur}s`
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
