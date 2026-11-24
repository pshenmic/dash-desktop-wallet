import { useLocation, useNavigate } from 'react-router-dom'
import { Button, InfoCircleIcon, KeyIcon } from '@renderer/components/dash-ui-kit-extended'
import Alert from '@renderer/components/ui/Alert'
import { DASHPAY_READINESS_BADGES, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import { READINESS_ALERT_COPY } from '@renderer/constants/dashPayKeys'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { DashPayReadiness, UsernameStatus } from '@renderer/enums/DashPay'
import { useDashPayUsernames } from '@renderer/hooks/useDashPayUsernames'
import type { DashPayNavigationState } from '@renderer/types/DashPay'
import type { ReadinessAlertProps } from '@renderer/types/DashPayKeys'
import { dashPayHref } from '@renderer/utils/dashPayIdentity'

export default function ReadinessAlert({ identity, readiness, onEnable }: ReadinessAlertProps): React.JSX.Element | null {
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useAuth()
  const { votingIds, usernamesKnown, err } = useDashPayUsernames(status?.selectedWalletId ?? undefined)

  if (readiness.readiness === DashPayReadiness.NeedsKeys) {
    return (
      <Alert
        tone={AlertTone.Warning}
        icon={<KeyIcon size={16} color={"currentColor"} />}
        title={READINESS_ALERT_COPY.needsKeysTitle}
        description={READINESS_ALERT_COPY.needsKeysDescription}
        actions={
          <Button type={"button"} size={"compact"} colorScheme={"primary"} onClick={onEnable}>
            {READINESS_ALERT_COPY.enable}
          </Button>
        }
      />
    )
  }

  if (readiness.readiness === DashPayReadiness.NoUsername) {
    const inVote = votingIds.has(identity.identifier)
    const unresolvedTitle = err == null ? READINESS_ALERT_COPY.checkingUsername : READINESS_ALERT_COPY.usernameStatusUnavailable
    const title = usernamesKnown ? READINESS_ALERT_COPY.noUsernameTitle : unresolvedTitle
    const registerHref = dashPayHref(DASHPAY_ROUTES.registerUsername, identity.identifier)
    const navigationState: DashPayNavigationState = { returnTo: location.pathname + location.search }
    return (
      <Alert
        tone={AlertTone.Info}
        icon={<InfoCircleIcon size={16} color={"currentColor"} />}
        title={inVote ? DASHPAY_READINESS_BADGES[UsernameStatus.Voting].text : title}
        description={inVote || usernamesKnown ? READINESS_ALERT_COPY.noUsernameDescription : undefined}
        actions={!inVote && usernamesKnown && (
          <button type={"button"} className={CHIP_ACTION} onClick={() => navigate(registerHref, { state: navigationState })}>
            {READINESS_ALERT_COPY.register}
          </button>
        )}
      />
    )
  }

  return null
}
