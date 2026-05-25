import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Config, Cue, SerializableConfig, SpeakerColorSlot } from '../../types'
import { useTranscriptSync } from '../../hooks/useTranscriptSync'
import { useRecorder } from '../../hooks/useRecorder'
import { Waveform } from '../../components/Waveform/Waveform'
import { ProgressBar } from '../../components/ProgressBar/ProgressBar'
import { TranscriptPanel } from '../../components/TranscriptPanel/TranscriptPanel'
import { RecordButton } from '../../components/RecordButton/RecordButton'
import styles from './PlayerScreen.module.css'

interface Props {
  config: Config
  cues: Cue[]
  onBack: () => void
  captureMode?: boolean
}

export function PlayerScreen({
  config,
  cues,
  onBack,
  captureMode = false
}: Props): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null)

  // Set the audio src — only in preview mode (captureMode has no audio element)
  useEffect(() => {
    if (captureMode) return
    const el = audioRef.current
    if (!el || !config.audioFile) return
    const url = URL.createObjectURL(config.audioFile)
    el.src = url
    return () => {
      URL.revokeObjectURL(url)
      el.src = ''
    }
  }, [config.audioFile, captureMode])

  // Scale the 1920x1080 canvas to fit the window — preview mode only
  const [playerStyle, setPlayerStyle] = useState<React.CSSProperties>({})
  useEffect(() => {
    if (captureMode) return
    const compute = (): void => {
      const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
      const x = (window.innerWidth - 1920 * scale) / 2
      const y = (window.innerHeight - 1080 * scale) / 2
      setPlayerStyle({
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        transformOrigin: '0 0'
      })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [captureMode])

  // Audio-driven sync (preview mode)
  const {
    activeIdx: syncActiveIdx,
    currentTime: syncTime,
    duration: syncDuration
  } = useTranscriptSync(audioRef, cues)

  // IPC-driven sync (capture mode)
  const [captureCurrentTime, setCaptureCurrentTime] = useState(0)
  const [captureDuration, setCaptureDuration] = useState(0)

  useEffect(() => {
    if (!captureMode) return
    return window.api.onPlaybackSync((time, dur) => {
      setCaptureCurrentTime(time)
      setCaptureDuration(dur)
    })
  }, [captureMode])

  const captureActiveIdx = useMemo(() => {
    if (!captureMode) return -1
    let idx = -1
    for (let i = cues.length - 1; i >= 0; i--) {
      if (captureCurrentTime >= cues[i].start) {
        idx = i
        break
      }
    }
    return idx
  }, [captureMode, captureCurrentTime, cues])

  const activeIdx = captureMode ? captureActiveIdx : syncActiveIdx
  const currentTime = captureMode ? captureCurrentTime : syncTime
  const duration = captureMode ? captureDuration : syncDuration

  // Signal the main process that this capture window is ready
  useEffect(() => {
    if (!captureMode) return
    document.title = 'ESL-REC-WINDOW'
    window.api.signalRecordingReady()
  }, [captureMode])

  const [countdown, setCountdown] = useState<number | null>(null)

  const serializableConfig: SerializableConfig = {
    channel: config.channel,
    episode: config.episode,
    episodeNumber: config.episodeNumber,
    description: config.description,
    level: config.level,
    transcript: config.transcript
  }

  const audioFilePath = useMemo(
    () =>
      config.audioFilePath ?? (config.audioFile ? window.api.getPathForFile(config.audioFile) : ''),
    [config.audioFile, config.audioFilePath]
  )

  const { isRecording, isConverting, startRecording, stopRecording, cancelAll } = useRecorder(
    audioRef,
    serializableConfig,
    cues,
    audioFilePath
  )

  // Broadcast playback position to the capture window — preview mode only
  useEffect(() => {
    if (captureMode) return
    const el = audioRef.current
    if (!el) return
    const onTime = (): void =>
      window.api.broadcastPlayback(el.currentTime, isFinite(el.duration) ? el.duration : 0)
    el.addEventListener('timeupdate', onTime)
    return () => el.removeEventListener('timeupdate', onTime)
  }, [captureMode])

  // Countdown tick
  useEffect(() => {
    if (countdown === null) return
    const id = setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null)
        startRecording()
          .then(() => audioRef.current?.play())
          .catch((err) => console.error('Recording failed:', err))
      } else {
        setCountdown(countdown - 1)
      }
    }, 1000)
    return () => clearTimeout(id)
  }, [countdown, startRecording])

  const handleStartCountdown = useCallback((): void => {
    const el = audioRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    setCountdown(3)
  }, [])

  const speakerColorMap = useMemo(() => {
    const map = new Map<string, SpeakerColorSlot>()
    const slots: SpeakerColorSlot[] = ['indigo', 'teal']
    let slotIdx = 0
    for (const cue of cues) {
      if (cue.speaker && !map.has(cue.speaker)) {
        map.set(cue.speaker, slots[slotIdx++ % slots.length])
      }
    }
    return map
  }, [cues])

  const allTags = config.level
    ? config.level
        .split(/[·•,|]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  const topTag = allTags[0] ?? ''
  const bottomTags = allTags.slice(1)

  const counterText = cues.length > 0 ? `${Math.max(0, activeIdx + 1)} / ${cues.length}` : ''

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space' && audioRef.current && !isRecording && countdown === null) {
        e.preventDefault()
        if (audioRef.current.paused) audioRef.current.play()
        else audioRef.current.pause()
      }
      if (e.code === 'Escape') {
        if (isRecording) {
          stopRecording()
          audioRef.current?.pause()
        } else if (countdown !== null) {
          setCountdown(null)
        }
      }
    },
    [isRecording, stopRecording, countdown]
  )

  useEffect(() => {
    if (captureMode) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown, captureMode])

  const hideControls = isRecording || captureMode

  return (
    <div className={`${styles.viewport} ${hideControls ? styles.recording : ''}`}>
      <div className={styles.playerRoot} style={captureMode ? {} : playerStyle}>
        <div className={styles.separator} />

        {/* ── Left panel (40%) ── */}
        <div className={styles.leftPanel}>
          <button
            className={`${styles.backBtn} ${hideControls ? styles.hidden : ''}`}
            onClick={onBack}
          >
            ← Back
          </button>

          <div className={styles.channelRow}>
            <span className={styles.channelDot} />
            <span className={styles.channelName}>{config.channel}</span>
          </div>

          <div className={styles.topBadgeRow}>
            <span className={styles.liveBadge}>
              <span className={styles.liveBadgeDot} />
              Live
            </span>
            {topTag && <span className={styles.topTagBadge}>{topTag}</span>}
          </div>

          {config.episodeNumber && (
            <p className={styles.episodeLabel}>Episode {config.episodeNumber}</p>
          )}

          <h1 className={styles.episodeTitle}>{config.episode}</h1>

          {config.description && <p className={styles.description}>{config.description}</p>}

          {bottomTags.length > 0 && (
            <div className={styles.bottomBadgeRow}>
              {bottomTags.map((tag, i) => (
                <span
                  key={tag}
                  className={`${styles.bottomTagBadge} ${i % 2 === 0 ? styles.badgeIndigo : styles.badgeRose}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <Waveform />

          <ProgressBar currentTime={currentTime} duration={duration} audioRef={audioRef} />
        </div>

        {/* ── Right panel (60%) ── */}
        <div className={styles.rightPanel}>
          <div className={`${styles.transcriptHeader} ${hideControls ? styles.hidden : ''}`}>
            <span className={styles.transcriptLabel}>Transcript</span>
            <div className={styles.transcriptDivider} />
          </div>

          <TranscriptPanel cues={cues} activeIdx={activeIdx} speakerColorMap={speakerColorMap} />

          {counterText && <div className={styles.counter}>{counterText}</div>}
        </div>

        {!captureMode && (
          <audio
            ref={audioRef}
            preload="auto"
            autoPlay
            onEnded={() => {
              if (isRecording) stopRecording()
            }}
          />
        )}

        {!captureMode && (
          <RecordButton
            isRecording={isRecording}
            onStart={handleStartCountdown}
            onStop={stopRecording}
            hidden={isRecording || countdown !== null}
          />
        )}

        {!captureMode && (isRecording || isConverting) && (
          <button className={styles.cancelBtn} onClick={cancelAll}>
            {isConverting ? 'Cancel conversion' : 'Cancel recording'}
          </button>
        )}

        {!captureMode && countdown !== null && (
          <div className={styles.countdownOverlay}>
            <span key={countdown} className={styles.countdownNumber}>
              {countdown}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
