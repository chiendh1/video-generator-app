import { forwardRef, useLayoutEffect, useRef, useState } from 'react'
import { Cue, SpeakerColorSlot } from '../../types'
import styles from './TranscriptPanel.module.css'

type LineState = 'past' | 'prev' | 'active' | 'next' | 'future'

interface LineProps {
  cue: Cue
  state: LineState
  speakerColor: SpeakerColorSlot
}

const TranscriptLine = forwardRef<HTMLDivElement, LineProps>(
  ({ cue, state, speakerColor }, ref) => {
    const accentColor = speakerColor === 'indigo' ? '#6366f1' : '#14b8a6'
    const accentBg = speakerColor === 'indigo' ? 'rgba(99,102,241,0.1)' : 'rgba(20,184,166,0.08)'

    return (
      <div
        ref={ref}
        className={`${styles.line} ${styles[state]}`}
        style={
          state === 'active' ? { borderLeftColor: accentColor, backgroundColor: accentBg } : {}
        }
      >
        {state === 'active' && cue.speaker && (
          <span className={styles.speakerLabel} style={{ color: accentColor }}>
            {cue.speaker}
          </span>
        )}
        <p className={styles.text}>{cue.text}</p>
      </div>
    )
  }
)
TranscriptLine.displayName = 'TranscriptLine'

interface PanelProps {
  cues: Cue[]
  activeIdx: number
  speakerColorMap: Map<string, SpeakerColorSlot>
}

export function TranscriptPanel({
  cues,
  activeIdx,
  speakerColorMap
}: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])
  const innerRef = useRef<HTMLDivElement>(null)
  const [translateY, setTranslateY] = useState(0)
  const didInit = useRef(false)

  useLayoutEffect(() => {
    if (activeIdx < 0) return

    const center = (): void => {
      const container = containerRef.current
      const activeLine = lineRefs.current[activeIdx]
      if (!container || !activeLine) return
      setTranslateY(500 / 2 - activeLine.offsetTop - activeLine.clientHeight / 2)
    }

    if (!didInit.current) {
      // First cue: center instantly before first paint, no animation
      didInit.current = true
      const inner = innerRef.current
      if (inner) inner.style.transition = 'none'
      center()
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (inner) inner.style.transition = ''
        })
      )
      return
    }

    // Subsequent cues: wait for 300ms line-size transitions to settle, then recompute
    const id = setTimeout(center, 100)
    return () => clearTimeout(id)
  }, [activeIdx])

  const getState = (i: number): LineState => {
    if (i === activeIdx) return 'active'
    if (i === activeIdx - 1) return 'prev'
    if (i === activeIdx + 1) return 'next'
    if (i < activeIdx) return 'past'
    return 'future'
  }

  return (
    <div ref={containerRef} className={styles.container}>
      <div
        ref={innerRef}
        className={styles.inner}
        style={{ transform: `translateY(${translateY}px)` }}
      >
        {cues.map((cue, i) => (
          <TranscriptLine
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            cue={cue}
            state={getState(i)}
            speakerColor={cue.speaker ? (speakerColorMap.get(cue.speaker) ?? 'indigo') : 'indigo'}
          />
        ))}
      </div>
    </div>
  )
}
