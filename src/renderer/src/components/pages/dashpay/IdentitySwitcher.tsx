import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import { AddIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import IdentitySelect from '@renderer/components/ui/IdentitySelect'
import { DASHPAY_READINESS_BADGES, READINESS_TONE_CLASS } from '@renderer/constants/dashPay'
import { DASHPAY_REGISTER_IDENTITY_HREF, REQUEST_COUNT_FORMS, SWITCHER_COPY } from '@renderer/constants/dashPayOverview'
import { POPOVER_OPTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { IdentitySelectAppearance } from '@renderer/enums/IdentitySelectAppearance'
import { useDashPayUsernames } from '@renderer/hooks/useDashPayUsernames'
import type { IdentityApiDto } from '@renderer/hooks/useIdentities'
import type { IdentitySwitcherProps } from '@renderer/types/DashPayOverview'
import { countLabel } from '@renderer/utils/countLabel'
import { incomingCountByIdentity } from '@renderer/utils/dashPayIdentity'
import IdentityReadinessBadge from './IdentityReadinessBadge'

export default function IdentitySwitcher({
  identities,
  identity,
  contacts,
  loading,
  err,
  onRetry,
  onSelect,
  ref,
}: IdentitySwitcherProps): React.JSX.Element {
  const navigate = useNavigate()
  const { status } = useAuth()
  const { identityStatus } = useDashPayUsernames(status?.selectedWalletId ?? undefined)
  const requests = useMemo(() => incomingCountByIdentity(contacts), [contacts])
  const attention = Object.entries(requests).some(([id, count]) => id !== identity?.identifier && count > 0)

  const renderTriggerMeta = (entry: IdentityApiDto): React.ReactNode => {
    const badgeStatus = identityStatus(entry)
    return badgeStatus == null ? null : <span className={READINESS_TONE_CLASS[badgeStatus]}>{DASHPAY_READINESS_BADGES[badgeStatus].text}</span>
  }

  const renderMeta = (entry: IdentityApiDto): React.ReactNode => {
    const count = requests[entry.identifier] ?? 0
    if (count === 0) return null
    return <span className={'font-bold dash-text-primary'}>{countLabel(count, REQUEST_COUNT_FORMS)}</span>
  }

  const footer = (
    <button
      type={'button'}
      onClick={() => navigate(DASHPAY_REGISTER_IDENTITY_HREF)}
      className={`flex w-full items-center gap-2 ${POPOVER_OPTION}`}
    >
      <AddIcon size={12} color={'currentColor'} className={'shrink-0 dash-text-primary'} />
      <Text reset size={12} weight={'medium'} color={'blue-mint'}>{SWITCHER_COPY.registerIdentity}</Text>
    </button>
  )

  return (
    <IdentitySelect
      ref={ref}
      appearance={IdentitySelectAppearance.Header}
      searchable
      identities={identities}
      loading={loading}
      error={err}
      selected={identity ?? undefined}
      onSelect={onSelect}
      onRetry={onRetry}
      renderTriggerMeta={renderTriggerMeta}
      renderMeta={renderMeta}
      renderBadge={entry => <IdentityReadinessBadge status={identityStatus(entry)} />}
      footer={footer}
      attention={attention}
    />
  )
}
