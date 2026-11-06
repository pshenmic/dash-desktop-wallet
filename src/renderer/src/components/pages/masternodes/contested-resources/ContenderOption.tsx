import { Text } from '@renderer/components/dash-ui-kit-extended'
import { CONTENDER_ROW_CLASS } from '@renderer/constants/nameContests'
import type { ContenderOptionProps } from '@renderer/types/NameContests'
import { formatShare } from '@renderer/utils/nameContests'
import ShareBar from './ShareBar'

export default function ContenderOption({ icon, title, badge, votes, share }: ContenderOptionProps): React.JSX.Element {
  return (
    <div className={CONTENDER_ROW_CLASS}>
      {icon}
      <div className={'flex min-w-0 flex-1 flex-col gap-1'}>
        <div className={'flex min-w-0 flex-wrap items-center gap-2'}>
          <Text size={14} weight={'medium'} color={'brand'} className={'min-w-0 wrap-anywhere'}>{title}</Text>
          {badge}
        </div>
        <ShareBar share={share} className={'mt-0.5 w-full'} />
      </div>
      <div className={'flex shrink-0 flex-col items-end gap-0.5'}>
        <Text size={16} weight={'bold'} color={'brand'} className={'tabular-nums'}>{votes}</Text>
        <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>{formatShare(share)}</Text>
      </div>
    </div>
  )
}
