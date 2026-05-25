declare global {
  interface Window {
    api: {
      getSources: () => Promise<Array<{ id: string; name: string }>>
      saveVideoAsMp4: (buffer: ArrayBuffer, audioPath: string) => Promise<string>
      prepareRecording: (config: unknown, cues: unknown) => Promise<string>
      getRecordingData: () => Promise<{ config: unknown; cues: unknown } | null>
      stopRecordingWindow: () => void
      broadcastPlayback: (time: number, duration: number) => void
      onPlaybackSync: (callback: (time: number, duration: number) => void) => () => void
      signalRecordingReady: () => void
      startPowerSaveBlocker: () => void
      stopPowerSaveBlocker: () => void
      generateSrt: (audioPath: string) => Promise<{ srtPath: string; content: string }>
      cancelAllProcesses: () => Promise<void>
      getPathForFile: (file: File) => string
      onLog: (
        callback: (line: { step: string; level: string; message: string }) => void
      ) => () => void
      startOffscreenRecording: (config: unknown, cues: unknown) => Promise<void>
      stopOffscreenRecording: (audioFilePath: string) => Promise<string>
    }
  }
}

export {}
