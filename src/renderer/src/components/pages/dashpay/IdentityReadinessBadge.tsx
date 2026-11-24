import { Tooltip } from '@renderer/components/dash-ui-kit-extended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import { DASHPAY_READINESS_BADGES } from '@renderer/constants/dashPay'
import { USERNAME_VOTE_TOOLTIP } from '@renderer/constants/dpns'
import { UsernameStatus } from '@renderer/enums/DashPay'
import type { IdentityReadinessBadgeProps } from '@renderer/types/DashPayOverview'

export default function IdentityReadinessBadge({ status }: IdentityReadinessBadgeProps): React.JSX.Element | null {
  if (status == null) return null
  const badge = DASHPAY_READINESS_BADGES[status]
  const pill = <CustomBadge variant={badge.variant} text={badge.text} className={'shrink-0 whitespace-nowrap'} />
  if (status !== UsernameStatus.Voting) return pill

  return (
    <Tooltip label={USERNAME_VOTE_TOOLTIP} align={'end'}>
      <span className={'inline-flex shrink-0'}>{pill}</span>
    </Tooltip>
  )
}
