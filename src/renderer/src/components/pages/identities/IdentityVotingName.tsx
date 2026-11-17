import { Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import { USERNAME_PRESENTATION, USERNAME_VOTE_TOOLTIP } from '@renderer/constants/dpns'
import { UsernamePresentation } from '@renderer/enums/DashPay'
import type { IdentityVotingNameProps } from '@renderer/types/Identities'

export default function IdentityVotingName({ name, extraNames = 0, onOpen }: IdentityVotingNameProps): React.JSX.Element {
  return (
    <div className={'flex min-w-0 items-center gap-1.5'}>
      <Text reset size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{name}</Text>
      <Tooltip label={USERNAME_VOTE_TOOLTIP}>
        <span className={`pointer-events-auto relative z-10 inline-flex shrink-0 whitespace-nowrap ${onOpen ? 'cursor-pointer' : ''}`} onClick={onOpen}>
          <CustomBadge variant={'accent'} text={USERNAME_PRESENTATION[UsernamePresentation.Voting].label} />
        </span>
      </Tooltip>
      {extraNames > 0 && <CustomBadge variant={'muted'} text={`+${extraNames}`} className={'shrink-0'} />}
    </div>
  )
}
