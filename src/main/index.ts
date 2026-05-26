import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  screen,
  powerSaveBlocker,
  dialog
} from 'electron'
import { join, dirname, basename, extname } from 'path'
import { writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { spawn, execFileSync } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let appWindow: BrowserWindow | null = null
let recorderWindow: BrowserWindow | null = null
let recordingData: { config: unknown; cues: unknown } | null = null
let powerSaveBlockerId: number | null = null

// Offscreen rendering state
let offscreenWindow: BrowserWindow | null = null
let offscreenFfmpegProc: ReturnType<typeof spawn> | null = null
let offscreenFfmpegDone: Promise<string> | null = null
let offscreenPaintOff: (() => void) | null = null
let recordingResolution = '1920x1080'

type LogStep = 'srt' | 'mp4' | 'system'
type LogLevel = 'info' | 'error'

function sendLog(step: LogStep, level: LogLevel, message: string): void {
  if (appWindow && !appWindow.isDestroyed()) {
    appWindow.webContents.send('log-update', { step, level, message })
  }
}

function makeLineLogger(step: LogStep, level: LogLevel): (data: Buffer) => void {
  let buf = ''
  return (data: Buffer) => {
    buf += data.toString()
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed) sendLog(step, level, trimmed)
    }
  }
}

const runningProcs = new Set<ReturnType<typeof spawn>>()

const WIDTH = 1920
const HEIGHT = 1080

function findBinary(name: string): string {
  const home = process.env.HOME ?? ''
  const dirs = [
    '/Users/liamdo/Workspace/whisper-env/bin',
    '/usr/local/bin',
    '/opt/homebrew/bin',
    `${home}/.local/bin`
  ]
  try {
    for (const ver of readdirSync(join(home, 'Library', 'Python'))) {
      dirs.push(join(home, 'Library', 'Python', ver, 'bin'))
    }
  } catch {
    /* no macOS pip --user installs */
  }

  for (const dir of dirs) {
    const p = join(dir, name)
    if (existsSync(p)) return p
  }

  for (const shell of ['/bin/zsh', '/bin/bash']) {
    try {
      const found = execFileSync(shell, ['-i', '-c', `which ${name}`], {
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8'
      }).trim()
      if (found) return found
    } catch {
      /* try next shell */
    }
  }

  throw new Error(`'${name}' not found. Install with: pip install openai-whisper`)
}

const SETUP_W = 820
const SETUP_H = 880

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: SETUP_W,
    height: SETUP_H,
    resizable: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  appWindow = mainWindow

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Required for Electron OSR on macOS — must be called before app is ready.
app.disableHardwareAcceleration()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── Window resize for screen transitions ────────────────────────────────
  ipcMain.on('enter-player-screen', () => {
    if (appWindow && !appWindow.isDestroyed()) {
      appWindow.setResizable(true)
      appWindow.setSize(WIDTH, HEIGHT)
      appWindow.setResizable(false)
      appWindow.center()
    }
  })

  ipcMain.on('leave-player-screen', () => {
    if (appWindow && !appWindow.isDestroyed()) {
      appWindow.setResizable(true)
      appWindow.setSize(SETUP_W, SETUP_H)
      appWindow.setResizable(false)
      appWindow.center()
    }
  })

  // ── Existing source lookup (kept for debug / fallback) ──────────────────
  ipcMain.handle('get-sources', async () => {
    let sources: Awaited<ReturnType<typeof desktopCapturer.getSources>>
    try {
      sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 0, height: 0 }
      })
    } catch (err) {
      console.error('[get-sources] desktopCapturer.getSources failed:', err)
      if (process.platform === 'darwin') {
        shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
        )
      }
      throw new Error(
        'Screen recording permission required. Find "Electron" in the list, enable it, then restart the app.'
      )
    }

    console.log(
      '[get-sources] available:',
      sources.map((s) => ({ id: s.id, name: s.name }))
    )

    const win = BrowserWindow.getAllWindows()[0]
    const title = win?.getTitle() ?? ''
    const own = sources.find((s) => s.name === title)
    if (own) return [own]

    console.warn('[get-sources] own window not found by title, returning all')
    return sources
  })

  // ── Off-screen recording window ─────────────────────────────────────────
  ipcMain.handle('prepare-recording', async (_, config: unknown, cues: unknown) => {
    recordingData = { config, cues }

    if (recorderWindow && !recorderWindow.isDestroyed()) {
      recorderWindow.close()
      recorderWindow = null
    }

    // Register the ready listener BEFORE creating the window to avoid a race.
    const ready = new Promise<void>((resolve) => {
      ipcMain.once('recording-view-ready', () => resolve())
    })

    recorderWindow = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      // Position off-screen so the user doesn't see it.
      x: -WIDTH,
      y: 0,
      show: true,
      frame: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      await recorderWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=recording`)
    } else {
      await recorderWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { mode: 'recording' }
      })
    }

    // Wait for RecordingView to signal it's rendered (max 5 s).
    await Promise.race([ready, new Promise<void>((r) => setTimeout(r, 5000))])

    // Brief pause so the OS reflects the title change in window listings.
    await new Promise<void>((r) => setTimeout(r, 300))

    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 }
    })

    const recTitle = recorderWindow.getTitle()
    const source = sources.find((s) => s.name === recTitle)

    if (!source) {
      console.error(
        '[prepare-recording] recording window not found. Available:',
        sources.map((s) => s.name),
        '| Looking for:',
        recTitle
      )
      throw new Error('Could not find recording window source')
    }

    return source.id
  })

  ipcMain.handle('get-recording-data', () => recordingData)

  ipcMain.on('stop-recording-window', () => {
    if (recorderWindow && !recorderWindow.isDestroyed()) {
      recorderWindow.close()
      recorderWindow = null
    }
  })

  ipcMain.on('start-power-save-blocker', () => {
    if (powerSaveBlockerId === null) {
      powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep')
    }
  })

  ipcMain.handle('generate-srt', async (_, audioPath: string) => {
    const audioDir = dirname(audioPath)
    const audioBasename = basename(audioPath, extname(audioPath))

    const whisperBin = findBinary('whisper')
    sendLog('srt', 'info', `Starting whisper (model: small) → ${audioDir}`)
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(whisperBin, [
        audioPath,
        '--model',
        'small',
        '--output_format',
        'srt',
        '--output_dir',
        audioDir,
        '--condition_on_previous_text',
        'False'
      ])
      runningProcs.add(proc)
      let errBuf = ''
      const logOut = makeLineLogger('srt', 'info')
      const logErr = makeLineLogger('srt', 'info')
      proc.stdout?.on('data', (d: Buffer) => logOut(d))
      proc.stderr?.on('data', (d: Buffer) => {
        errBuf += d
        logErr(d)
      })
      proc.on('close', (code) => {
        runningProcs.delete(proc)
        if (code === 0) {
          sendLog('srt', 'info', 'SRT generation complete.')
          resolve()
        } else if (code === null) {
          reject(new Error('CANCELLED'))
        } else {
          sendLog('srt', 'error', `whisper exited with code ${code}`)
          reject(new Error(`whisper failed (code ${code}): ${errBuf.slice(-300)}`))
        }
      })
      proc.on('error', (err) => {
        runningProcs.delete(proc)
        reject(err)
      })
    })

    const srtPath = join(audioDir, `${audioBasename}.srt`)
    const content = readFileSync(srtPath, 'utf-8')
    return { srtPath, content }
  })

  ipcMain.on('stop-power-save-blocker', () => {
    if (powerSaveBlockerId !== null) {
      powerSaveBlocker.stop(powerSaveBlockerId)
      powerSaveBlockerId = null
    }
  })

  ipcMain.on('broadcast-playback', (_, time: number, duration: number) => {
    for (const win of [recorderWindow, offscreenWindow]) {
      if (win && !win.isDestroyed()) {
        win.webContents.send('playback-sync', time, duration)
      }
    }
  })

  // ── Offscreen rendering → ffmpeg stdin ──────────────────────────────────
  ipcMain.handle('start-offscreen-recording', async (_, config: unknown, cues: unknown) => {
    recordingData = { config, cues }
    recordingResolution = (config as { resolution?: string }).resolution ?? '1920x1080'

    if (offscreenWindow && !offscreenWindow.isDestroyed()) {
      offscreenWindow.close()
      offscreenWindow = null
    }

    const ready = new Promise<void>((resolve) => {
      ipcMain.once('recording-view-ready', () => resolve())
    })

    offscreenWindow = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        backgroundThrottling: false,
        offscreen: true
      }
    })

    offscreenWindow.webContents.setFrameRate(30)

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      await offscreenWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mode=recording`)
    } else {
      await offscreenWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { mode: 'recording' }
      })
    }

    await Promise.race([ready, new Promise<void>((r) => setTimeout(r, 5000))])

    // Sniff actual pixel dimensions from the first paint event — on retina
    // displays the bitmap is 2× (or more) the logical window size.  Feeding
    // the wrong size to ffmpeg corrupts the row-alignment of every frame.
    const actualSize = await new Promise<{ w: number; h: number }>((resolve) => {
      const once = (_e: unknown, _dirty: unknown, img: Electron.NativeImage): void => {
        offscreenWindow!.webContents.removeListener('paint', once as never)
        const { width, height } = img.getSize()
        resolve({ w: width, h: height })
      }
      offscreenWindow!.webContents.on('paint', once as never)
    })

    const { w: pixW, h: pixH } = actualSize
    const [outW, outH] = recordingResolution.split('x').map(Number)
    const needsScale = pixW !== outW || pixH !== outH
    sendLog(
      'mp4',
      'info',
      `OSR pixel size: ${pixW}×${pixH}${needsScale ? ` → scale ${outW}×${outH}` : ''}`
    )

    const tempMp4 = join(tmpdir(), `esl-osr-${Date.now()}.mp4`)
    const ffmpegBin = findBinary('ffmpeg')

    const ffmpegArgs = [
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'bgra',
      '-s',
      `${pixW}x${pixH}`,
      '-r',
      '30',
      '-i',
      'pipe:0',
      ...(needsScale ? ['-vf', `scale=${outW}:${outH}:flags=lanczos`] : []),
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '8M',
      tempMp4
    ]

    const proc = spawn(ffmpegBin, ffmpegArgs)

    offscreenFfmpegProc = proc
    runningProcs.add(proc)
    const logErr = makeLineLogger('mp4', 'info')
    proc.stderr?.on('data', (d: Buffer) => logErr(d))

    offscreenFfmpegDone = new Promise<string>((resolve, reject) => {
      proc.on('close', (code) => {
        runningProcs.delete(proc)
        if (code === 0) resolve(tempMp4)
        else if (code === null) resolve(tempMp4)
        else reject(new Error(`ffmpeg OSR exited with code ${code}`))
      })
      proc.on('error', reject)
    })

    const onPaint = (_e: unknown, _dirty: unknown, image: Electron.NativeImage): void => {
      if (proc.stdin && !proc.stdin.destroyed) {
        proc.stdin.write(image.toBitmap())
      }
    }

    offscreenWindow.webContents.on('paint', onPaint)

    const capturedWin = offscreenWindow
    offscreenPaintOff = (): void => {
      if (!capturedWin.isDestroyed()) {
        capturedWin.webContents.off('paint', onPaint)
        capturedWin.webContents.stopPainting()
      }
    }

    sendLog('mp4', 'info', `OSR recording started → ${tempMp4}`)
  })

  ipcMain.handle('stop-offscreen-recording', async (_, audioFilePath: string) => {
    offscreenPaintOff?.()
    offscreenPaintOff = null

    if (offscreenFfmpegProc?.stdin && !offscreenFfmpegProc.stdin.destroyed) {
      offscreenFfmpegProc.stdin.end()
    }
    offscreenFfmpegProc = null

    const tempMp4 = await offscreenFfmpegDone
    offscreenFfmpegDone = null

    if (offscreenWindow && !offscreenWindow.isDestroyed()) {
      offscreenWindow.close()
      offscreenWindow = null
    }

    const audioDir = dirname(audioFilePath)
    const audioBasename = basename(audioFilePath, extname(audioFilePath))
    const finalMp4 = join(audioDir, `${audioBasename}.mp4`)
    const ffmpegBin = findBinary('ffmpeg')

    const resourcesDir = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
    const introPath = join(resourcesDir, 'intro.mp4')
    const hasIntro = existsSync(introPath)

    sendLog('mp4', 'info', hasIntro ? `Merging intro → ${finalMp4}` : `Muxing audio → ${finalMp4}`)

    try {
      await new Promise<void>((resolve, reject) => {
        const args = hasIntro
          ? [
              '-y',
              '-i',
              introPath,
              '-fflags',
              '+genpts',
              '-i',
              tempMp4!,
              '-i',
              audioFilePath,
              '-filter_complex',
              `[0:v]scale=${recordingResolution.replace('x', ':')}:flags=lanczos,setsar=1[v0];[v0][0:a][1:v][2:a]concat=n=2:v=1:a=1[v][a]`,
              '-map',
              '[v]',
              '-map',
              '[a]',
              '-c:v',
              'libx264',
              '-preset',
              'fast',
              '-b:v',
              '8M',
              '-pix_fmt',
              'yuv420p',
              '-c:a',
              'aac',
              '-b:a',
              '320k',
              '-shortest',
              finalMp4
            ]
          : [
              '-y',
              '-i',
              tempMp4!,
              '-i',
              audioFilePath,
              '-map',
              '0:v',
              '-map',
              '1:a',
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              '-b:a',
              '320k',
              '-shortest',
              finalMp4
            ]

        const muxProc = spawn(ffmpegBin, args)
        runningProcs.add(muxProc)
        let errBuf = ''
        const logMux = makeLineLogger('mp4', 'info')
        muxProc.stderr?.on('data', (d: Buffer) => {
          errBuf += d
          logMux(d)
        })
        muxProc.on('close', (code) => {
          runningProcs.delete(muxProc)
          if (code === 0) {
            sendLog('mp4', 'info', `Saved: ${finalMp4}`)
            resolve()
          } else if (code === null) {
            reject(new Error('CANCELLED'))
          } else {
            reject(new Error(`ffmpeg mux failed (code ${code}): ${errBuf.slice(-400)}`))
          }
        })
        muxProc.on('error', reject)
      })
    } finally {
      try {
        unlinkSync(tempMp4!)
      } catch {
        /* ignore */
      }
    }

    return finalMp4
  })

  // ── Save video as MP4 ────────────────────────────────────────────────────
  ipcMain.handle('save-video-as-mp4', async (_, buffer: ArrayBuffer, audioPath: string) => {
    const audioDir = dirname(audioPath)
    const audioBasename = basename(audioPath, extname(audioPath))
    const mp4Path = join(audioDir, `${audioBasename}.mp4`)
    const tempWebm = join(tmpdir(), `esl-rec-${Date.now()}.webm`)

    writeFileSync(tempWebm, Buffer.from(buffer))

    const resourcesDir = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
    const introPath = join(resourcesDir, 'intro.mp4')
    const hasIntro = existsSync(introPath)

    const ffmpegBin = findBinary('ffmpeg')
    sendLog('mp4', 'info', `Intro path: ${introPath} (found: ${hasIntro})`)
    sendLog(
      'mp4',
      'info',
      hasIntro ? `Merging intro + recording → ${mp4Path}` : `Converting to MP4 → ${mp4Path}`
    )

    try {
      await new Promise<void>((resolve, reject) => {
        const args = hasIntro
          ? [
              '-y',
              '-i',
              introPath,
              '-fflags',
              '+genpts',
              '-i',
              tempWebm,
              '-filter_complex',
              `[0:v]scale=${WIDTH}:${HEIGHT}:flags=lanczos,setsar=1[v0];[v0][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]`,
              '-map',
              '[v]',
              '-map',
              '[a]',
              '-r',
              '60',
              '-b:v',
              '25M',
              '-b:a',
              '320k',
              mp4Path
            ]
          : [
              '-y',
              '-fflags',
              '+genpts',
              '-i',
              tempWebm,
              '-r',
              '60',
              '-b:v',
              '25M',
              '-b:a',
              '320k',
              mp4Path
            ]

        const proc = spawn(ffmpegBin, args)
        runningProcs.add(proc)
        let errBuf = ''
        const logErr = makeLineLogger('mp4', 'info')
        proc.stderr?.on('data', (d: Buffer) => {
          errBuf += d
          logErr(d)
        })
        proc.on('close', (code) => {
          runningProcs.delete(proc)
          if (code === 0) {
            sendLog('mp4', 'info', `Saved: ${mp4Path}`)
            resolve()
          } else if (code === null) {
            reject(new Error('CANCELLED'))
          } else {
            sendLog('mp4', 'error', `ffmpeg exited with code ${code}`)
            reject(new Error(`ffmpeg failed (code ${code}): ${errBuf.slice(-400)}`))
          }
        })
        proc.on('error', (err) => {
          runningProcs.delete(proc)
          reject(err)
        })
      })
    } finally {
      try {
        unlinkSync(tempWebm)
      } catch {
        /* ignore */
      }
    }

    return mp4Path
  })

  ipcMain.handle('read-file', async (_, filePath: string) => {
    const buffer = readFileSync(filePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  })

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('merge-audio-folder', async (_, folderPath: string) => {
    const audioExts = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'])
    const files = readdirSync(folderPath)
      .filter((f) => audioExts.has(extname(f).toLowerCase()))
      .sort()
      .map((f) => join(folderPath, f))

    if (files.length === 0) throw new Error('No audio files found in folder')

    const listFile = join(tmpdir(), `esl-concat-${Date.now()}.txt`)
    const listContent = files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n')
    writeFileSync(listFile, listContent)

    const outputPath = join(folderPath, `merged_audio_${Date.now()}.mp3`)
    const ffmpegBin = findBinary('ffmpeg')

    sendLog('system', 'info', `Merging ${files.length} audio files → ${outputPath}`)

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(ffmpegBin, [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          listFile,
          '-c:a',
          'libmp3lame',
          '-q:a',
          '2',
          outputPath
        ])
        runningProcs.add(proc)
        const logErr = makeLineLogger('system', 'info')
        proc.stderr?.on('data', (d: Buffer) => logErr(d))
        proc.on('close', (code) => {
          runningProcs.delete(proc)
          try {
            unlinkSync(listFile)
          } catch {
            /* ignore */
          }
          if (code === 0) {
            sendLog('system', 'info', `Merged audio saved: ${outputPath}`)
            resolve()
          } else if (code === null) {
            reject(new Error('CANCELLED'))
          } else {
            reject(new Error(`ffmpeg merge failed (code ${code})`))
          }
        })
        proc.on('error', (err) => {
          runningProcs.delete(proc)
          try {
            unlinkSync(listFile)
          } catch {
            /* ignore */
          }
          reject(err)
        })
      })
    } catch (err) {
      try {
        unlinkSync(listFile)
      } catch {
        /* ignore */
      }
      throw err
    }

    return { outputPath, fileCount: files.length }
  })

  ipcMain.handle('cancel-all-processes', () => {
    offscreenPaintOff?.()
    offscreenPaintOff = null
    if (offscreenFfmpegProc?.stdin && !offscreenFfmpegProc.stdin.destroyed) {
      offscreenFfmpegProc.stdin.end()
    }
    offscreenFfmpegProc = null
    offscreenFfmpegDone = null
    if (offscreenWindow && !offscreenWindow.isDestroyed()) {
      offscreenWindow.close()
      offscreenWindow = null
    }
    for (const proc of runningProcs) {
      proc.kill('SIGTERM')
    }
    runningProcs.clear()
    sendLog('system', 'info', 'All processes cancelled.')
  })

  createWindow()

  app.on('activate', () => {
    const visible = BrowserWindow.getAllWindows().filter(
      (w) => !w.isDestroyed() && w !== recorderWindow
    )
    if (visible.length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
