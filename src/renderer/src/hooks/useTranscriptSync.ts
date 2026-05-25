import { RefObject, useEffect, useState } from 'react'
import { Cue } from '../types'

export function useTranscriptSync(
  audioRef: RefObject<HTMLAudioElement | null>,
  cues: Cue[]
): { activeIdx: number; currentTime: number; duration: number } {
  const [activeIdx, setActiveIdx] = useState(-1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onTimeUpdate = (): void => {
      const t = el.currentTime
      setCurrentTime(t)
      let idx = -1
      for (let i = cues.length - 1; i >= 0; i--) {
        if (t >= cues[i].start) {
          idx = i
          break
        }
      }
      setActiveIdx(idx)
    }

    const onDurationChange = (): void => {
      setDuration(isFinite(el.duration) ? el.duration : 0)
    }

    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('durationchange', onDurationChange)
    el.addEventListener('loadedmetadata', onDurationChange)

    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('durationchange', onDurationChange)
      el.removeEventListener('loadedmetadata', onDurationChange)
    }
  }, [audioRef, cues])

  return { activeIdx, currentTime, duration }
}
