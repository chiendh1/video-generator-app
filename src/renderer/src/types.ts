export interface Cue {
  start: number
  end: number
  text: string
  speaker: string | null
}

export interface Config {
  channel: string
  episode: string
  episodeNumber: string
  description: string
  level: string
  audioFile: File | null
  transcript: string
}

export type SpeakerColorSlot = 'indigo' | 'teal'

export interface LogLine {
  id: number
  step: 'srt' | 'mp4' | 'system'
  level: 'info' | 'error'
  message: string
}

export type SerializableConfig = Omit<Config, 'audioFile'>

declare global {
  interface Window {
    api: {
      getSources: () => Promise<Array<{ id: string; name: string }>>
      saveVideoAsMp4: (buffer: ArrayBuffer, audioPath: string) => Promise<string>
      prepareRecording: (config: SerializableConfig, cues: Cue[]) => Promise<string>
      getRecordingData: () => Promise<{ config: SerializableConfig; cues: Cue[] } | null>
      stopRecordingWindow: () => void
      broadcastPlayback: (time: number, duration: number) => void
      onPlaybackSync: (callback: (time: number, duration: number) => void) => () => void
      signalRecordingReady: () => void
      startPowerSaveBlocker: () => void
      stopPowerSaveBlocker: () => void
      generateSrt: (audioPath: string) => Promise<{ srtPath: string; content: string }>
      cancelAllProcesses: () => Promise<void>
      getPathForFile: (file: File) => string
      onLog: (callback: (line: LogLine) => void) => () => void
      startOffscreenRecording: (config: SerializableConfig, cues: Cue[]) => Promise<void>
      stopOffscreenRecording: (audioFilePath: string) => Promise<string>
    }
  }
}
