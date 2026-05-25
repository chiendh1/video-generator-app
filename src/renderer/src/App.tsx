import { useEffect, useMemo, useRef, useState } from 'react'
import { Config, Cue, LogLine, SerializableConfig } from './types'
import { SetupScreen } from './screens/SetupScreen/SetupScreen'
import { PlayerScreen } from './screens/PlayerScreen/PlayerScreen'
import { LogPanel } from './components/LogPanel/LogPanel'
import { parseTranscript } from './utils/transcript'

const isRecordingMode = new URLSearchParams(window.location.search).get('mode') === 'recording'

function CaptureWindow(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const [cues, setCues] = useState<Cue[]>([])

  useEffect(() => {
    window.api.getRecordingData().then((data) => {
      if (!data) return
      const cfg = data.config as SerializableConfig
      setConfig({ ...cfg, audioFile: null })
      setCues(data.cues as Cue[])
    })
  }, [])

  if (!config) return <div style={{ background: '#0d0b1e', width: '100vw', height: '100vh' }} />
  return <PlayerScreen config={config} cues={cues} captureMode onBack={() => {}} />
}

function App(): React.JSX.Element {
  const [config, setConfig] = useState<Config | null>(null)
  const cues = useMemo(() => (config ? parseTranscript(config.transcript) : []), [config])
  const [logs, setLogs] = useState<LogLine[]>([])
  const logIdRef = useRef(0)

  useEffect(() => {
    return window.api.onLog((line) => {
      setLogs((prev) => [...prev.slice(-300), { ...line, id: logIdRef.current++ } as LogLine])
    })
  }, [])

  if (isRecordingMode) return <CaptureWindow />

  return (
    <>
      {!config ? (
        <SetupScreen onStart={setConfig} />
      ) : (
        <PlayerScreen config={config} cues={cues} onBack={() => setConfig(null)} />
      )}
      <LogPanel logs={logs} onClear={() => setLogs([])} />
    </>
  )
}

export default App
