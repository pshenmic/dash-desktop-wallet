import { PERCENT_SCALE, SHARE_BAR_FILL_CLASS, SHARE_BAR_TRACK_CLASS } from '@renderer/constants/nameContests'
import type { ShareBarProps } from '@renderer/types/NameContests'

export default function ShareBar({ share, className = '' }: ShareBarProps): React.JSX.Element {
  return (
    <span aria-hidden={'true'} className={`block ${className}`}>
      <span className={`block ${SHARE_BAR_TRACK_CLASS}`}>
        <span className={`block ${SHARE_BAR_FILL_CLASS}`} style={{ width: `${share * PERCENT_SCALE}%` }} />
      </span>
    </span>
  )
}
