import { SpeakerColorSlot } from '../../types'
import styles from './Nameplate.module.css'

interface Props {
  speaker: string | null
  colorSlot: SpeakerColorSlot
}

export function Nameplate({ speaker, colorSlot }: Props): React.JSX.Element {
  const isAmber = colorSlot === 'indigo'
  const initial = speaker ? speaker.trim()[0].toUpperCase() : '?'

  return (
    <div className={`${styles.root} ${isAmber ? styles.rootAmber : styles.rootTeal}`}>
      <div className={`${styles.avatar} ${isAmber ? styles.avatarAmber : styles.avatarTeal}`}>
        {initial}
      </div>
      <div className={styles.info}>
        <span className={styles.label}>Now Speaking</span>
        <span className={`${styles.name} ${isAmber ? styles.nameAmber : styles.nameTeal}`}>
          {speaker ?? '—'}
        </span>
      </div>
    </div>
  )
}
