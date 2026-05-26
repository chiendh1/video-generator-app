import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  saveVideoAsMp4: (buffer: ArrayBuffer, audioPath: string) =>
    ipcRenderer.invoke('save-video-as-mp4', buffer, audioPath),
  prepareRecording: (config: unknown, cues: unknown) =>
    ipcRenderer.invoke('prepare-recording', config, cues),
  getRecordingData: () => ipcRenderer.invoke('get-recording-data'),
  stopRecordingWindow: () => ipcRenderer.send('stop-recording-window'),
  broadcastPlayback: (time: number, duration: number) =>
    ipcRenderer.send('broadcast-playback', time, duration),
  onPlaybackSync: (callback: (time: number, duration: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, time: number, duration: number): void =>
      callback(time, duration)
    ipcRenderer.on('playback-sync', handler)
    return () => ipcRenderer.removeListener('playback-sync', handler)
  },
  signalRecordingReady: () => ipcRenderer.send('recording-view-ready'),
  startPowerSaveBlocker: () => ipcRenderer.send('start-power-save-blocker'),
  stopPowerSaveBlocker: () => ipcRenderer.send('stop-power-save-blocker'),
  generateSrt: (audioPath: string) => ipcRenderer.invoke('generate-srt', audioPath),
  cancelAllProcesses: () => ipcRenderer.invoke('cancel-all-processes'),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  startOffscreenRecording: (config: unknown, cues: unknown) =>
    ipcRenderer.invoke('start-offscreen-recording', config, cues),
  stopOffscreenRecording: (audioFilePath: string) =>
    ipcRenderer.invoke('stop-offscreen-recording', audioFilePath),
  onLog: (callback: (line: { step: string; level: string; message: string }) => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      line: { step: string; level: string; message: string }
    ): void => callback(line)
    ipcRenderer.on('log-update', handler)
    return () => ipcRenderer.removeListener('log-update', handler)
  },
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  mergeAudioFolder: (folderPath: string) =>
    ipcRenderer.invoke('merge-audio-folder', folderPath),
  enterPlayerScreen: () => ipcRenderer.send('enter-player-screen'),
  leavePlayerScreen: () => ipcRenderer.send('leave-player-screen')
})
