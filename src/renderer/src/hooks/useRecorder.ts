import { RefObject, useCallback, useRef, useState } from 'react'
import { Cue, SerializableConfig } from '../types'

export function useRecorder(
  _audioRef: RefObject<HTMLAudioElement | null>,
  config: SerializableConfig,
  cues: Cue[],
  audioFilePath: string
): {
  isRecording: boolean
  isConverting: boolean
  startRecording: () => Promise<void>
  stopRecording: () => void
  cancelAll: () => void
} {
  const [isRecording, setIsRecording] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const cancelledRef = useRef(false)

  const cancelAll = useCallback(() => {
    cancelledRef.current = true
    window.api.cancelAllProcesses()
    setIsRecording(false)
    setIsConverting(false)
  }, [])

  const startRecording = async (): Promise<void> => {
    cancelledRef.current = false
    try {
      await window.api.startOffscreenRecording(config, cues)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Recording failed to start:\n\n${msg}`)
      return
    }
    window.api.startPowerSaveBlocker()
    setIsRecording(true)
  }

  const stopRecording = useCallback((): void => {
    setIsRecording(false)
    setIsConverting(true)
    window.api
      .stopOffscreenRecording(audioFilePath)
      .then(() => {
        if (!cancelledRef.current) setIsConverting(false)
      })
      .catch((err) => {
        if (!cancelledRef.current) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg !== 'CANCELLED') alert(`Failed to save video:\n\n${msg}`)
          setIsConverting(false)
        }
      })
      .finally(() => {
        window.api.stopPowerSaveBlocker()
      })
  }, [audioFilePath])

  return { isRecording, isConverting, startRecording, stopRecording, cancelAll }
}
