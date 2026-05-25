import { useRef, useState } from 'react'
import { Config } from '../../types'
import styles from './SetupScreen.module.css'

interface Props {
  onStart: (config: Config) => void
}

export function SetupScreen({ onStart }: Props): React.JSX.Element {
  const [channel, setChannel] = useState('English Podcast Conversation')
  const [episode, setEpisode] = useState('')
  const [episodeNumber, setEpisodeNumber] = useState('01')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('Beginner · About You')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [srtFile, setSrtFile] = useState<File | null>(null)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [isGeneratingSrt, setIsGeneratingSrt] = useState(false)

  const srtCancelledRef = useRef(false)

  const handleGenerateSrt = async (): Promise<void> => {
    if (!audioFile) return
    srtCancelledRef.current = false
    const audioPath = window.api.getPathForFile(audioFile)
    setIsGeneratingSrt(true)
    setError('')
    try {
      const { srtPath, content } = await window.api.generateSrt(audioPath)
      setTranscript(content)
      setSrtFile(
        new File([content], srtPath.split('/').pop() ?? 'transcript.srt', { type: 'text/plain' })
      )
    } catch (err) {
      if (!srtCancelledRef.current) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg !== 'CANCELLED') setError(`SRT generation failed: ${msg}`)
      }
    } finally {
      setIsGeneratingSrt(false)
      srtCancelledRef.current = false
    }
  }

  const handleCancelSrt = (): void => {
    srtCancelledRef.current = true
    window.api.cancelAllProcesses()
    setIsGeneratingSrt(false)
  }

  const handleSrtChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0] ?? null
    setSrtFile(file)
    if (!file) {
      setTranscript('')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setTranscript((ev.target?.result as string) ?? '')
    reader.readAsText(file, 'utf-8')
  }

  const handleStart = (): void => {
    if (!channel.trim()) {
      setError('Channel name is required.')
      return
    }
    if (!episode.trim()) {
      setError('Episode title is required.')
      return
    }
    if (!audioFile) {
      setError('Please select an audio file.')
      return
    }
    setError('')
    onStart({
      channel: channel.trim(),
      episode: episode.trim(),
      episodeNumber: episodeNumber.trim(),
      description: description.trim(),
      level: level.trim(),
      audioFile,
      transcript
    })
  }

  return (
    <div className={styles.root}>
      <div className={`${styles.blob} ${styles.blob1}`} />
      <div className={`${styles.blob} ${styles.blob2}`} />
      <div className={`${styles.blob} ${styles.blob3}`} />

      <div className={styles.card}>
        <h1 className={styles.title}>ESL Podcast Generator</h1>
        <p className={styles.subtitle}>
          Configure your episode, then hit Start to preview and record.
        </p>

        <div className={styles.fields}>
          <label className={styles.field}>
            <span>Channel Name</span>
            <input
              type="text"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="e.g. ESL Podcast VN"
            />
          </label>

          <div className={styles.row}>
            <label className={`${styles.field} ${styles.grow}`}>
              <span>Episode Title</span>
              <input
                type="text"
                value={episode}
                onChange={(e) => setEpisode(e.target.value)}
                placeholder="e.g. Meeting Someone New"
              />
            </label>
            <label className={styles.field}>
              <span>Episode #</span>
              <input
                type="text"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
                placeholder="12"
                className={styles.inputNarrow}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Description (optional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown below the title"
            />
          </label>

          <label className={styles.field}>
            <span>Tags (optional — separate with ·)</span>
            <input
              type="text"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="e.g. Beginner · Conversation · Dialogue"
            />
          </label>

          <div className={styles.field}>
            <span>Audio File</span>
            <div className={styles.audioRow}>
              <button
                className={styles.fileBtn}
                onClick={() => document.getElementById('audio-file-input')?.click()}
              >
                {audioFile ? `✓  ${audioFile.name}` : 'Choose MP3 or WAV…'}
              </button>
              {isGeneratingSrt ? (
                <button className={styles.cancelSrtBtn} onClick={handleCancelSrt}>
                  Cancel
                </button>
              ) : (
                <button
                  className={styles.generateBtn}
                  onClick={handleGenerateSrt}
                  disabled={!audioFile}
                >
                  Generate SRT
                </button>
              )}
            </div>
            <input
              id="audio-file-input"
              type="file"
              accept=".mp3,.wav,.m4a,.ogg"
              style={{ display: 'none' }}
              onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className={styles.field}>
            <span>Transcript SRT (optional)</span>
            <button
              className={styles.fileBtn}
              onClick={() => document.getElementById('srt-file-input')?.click()}
            >
              {srtFile ? `✓  ${srtFile.name}` : 'Choose .srt file…'}
            </button>
            <input
              id="srt-file-input"
              type="file"
              accept=".srt"
              style={{ display: 'none' }}
              onChange={handleSrtChange}
            />
          </div>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.startBtn} onClick={handleStart}>
          Start Player &rarr;
        </button>
      </div>
    </div>
  )
}
