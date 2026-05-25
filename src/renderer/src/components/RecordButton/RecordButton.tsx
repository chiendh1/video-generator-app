import styles from './RecordButton.module.css'

interface Props {
  isRecording: boolean
  onStart: () => void
  onStop: () => void
  hidden?: boolean
}

export function RecordButton({ isRecording, onStart, onStop, hidden }: Props): React.JSX.Element {
  const handleClick = (): void => {
    if (isRecording) onStop()
    else onStart()
  }

  return (
    <button
      className={`${styles.btn} ${isRecording ? styles.recording : ''} ${hidden ? styles.hidden : ''}`}
      onClick={handleClick}
      title={isRecording ? 'Stop recording' : 'Record'}
    >
      {isRecording ? (
        <span className={styles.stopIcon} />
      ) : (
        <span className={styles.dots}>•••</span>
      )}
    </button>
  )
}
