import { Tooltip } from '@renderer/components/dash-ui-kit-extended'
import StatusPill from '@renderer/components/ui/StatusPill'
import { USERNAME_PRESENTATION, USERNAME_VOTE_TOOLTIP } from '@renderer/constants/dpns'
import { UsernamePresentation } from '@renderer/enums/DashPay'
import type { UsernameRowModel } from '@renderer/types/Dpns'

export default function UsernameStatusPill({ presentation }: Pick<UsernameRowModel, 'presentation'>): React.JSX.Element {
  const { tone, label } = USERNAME_PRESENTATION[presentation]
  const pill = <StatusPill tone={tone}>{label}</StatusPill>
  if (presentation !== UsernamePresentation.Voting) return pill

  return (
    <Tooltip label={USERNAME_VOTE_TOOLTIP} align={'end'}>
      <span className={'inline-flex shrink-0'}>{pill}</span>
    </Tooltip>
  )
}
