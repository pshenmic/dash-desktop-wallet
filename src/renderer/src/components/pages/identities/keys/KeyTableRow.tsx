import { Text } from '@renderer/components/dash-ui-kit-extended'
import CreditsAmount from '@renderer/components/ui/CreditsAmount'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import StatusPill from '@renderer/components/ui/StatusPill'
import {
  IDENTITY_KEY_LEVEL_LABELS,
  IDENTITY_KEY_PURPOSE_LABELS,
  IDENTITY_KEY_TABLE_GRID,
  IDENTITY_KEY_TYPE_LABELS,
  IDENTITY_KEY_UPDATE_COPY,
  IDENTITY_KEYS_COPY,
  KEY_LIMITS_COPY,
} from '@renderer/constants/identityKeys'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { KeyTableRowProps } from '@renderer/types/IdentityKeys'
import { formatTimestamp } from '@renderer/utils/date'
import { isIdentityKeyActive, isIdentityKeyExpired } from '@renderer/utils/identities'
import { identityKeyAction } from '@renderer/utils/identityKeyActions'
import { keyBoundsLabel, keyLabel } from '@renderer/utils/identityKeyRequests'

export default function KeyTableRow({ identityKey, now, onAction }: KeyTableRowProps): React.JSX.Element {
  const active = isIdentityKeyActive(identityKey)
  const expired = isIdentityKeyExpired(identityKey, now)
  const action = identityKeyAction(identityKey)
  const bounds = keyBoundsLabel(identityKey.contractBounds)
  let boundsCell = <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{IDENTITY_KEYS_COPY.unbound}</Text>
  if (bounds?.isDashPay) {
    boundsCell = <CustomBadge variant={'accent'} text={bounds.text} className={'max-w-full'} />
  } else if (bounds != null) {
    boundsCell = <Text size={12} weight={'medium'} color={'brand'} className={'min-w-0 font-mono break-all'}>{bounds.text}</Text>
  }

  let limitsCell = <Text size={14} weight={'medium'} color={'brand'} opacity={50}>{IDENTITY_KEYS_COPY.unbound}</Text>
  if (identityKey.totalBudget != null || identityKey.expiresAt != null) {
    limitsCell = (
      <div className={'flex min-w-0 flex-col gap-0.5'}>
        {identityKey.totalBudget != null && (
          <CreditsAmount
            credits={identityKey.totalBudget}
            prefix={`${KEY_LIMITS_COPY.maxPrefix} `}
            exact
            showFiat={false}
            className={'text-xs font-medium text-dash-primary-dark-blue dark:text-white'}
          />
        )}
        {identityKey.expiresAt != null && (
          <Text
            reset
            size={12}
            weight={'medium'}
            color={expired ? 'red' : 'brand'}
            opacity={expired ? 100 : 60}
            className={'text-[.6875rem]! truncate tabular-nums'}
          >
            {`${KEY_LIMITS_COPY.untilPrefix} ${formatTimestamp(new Date(identityKey.expiresAt))}`}
          </Text>
        )}
      </div>
    )
  }

  let statusPill = <StatusPill tone={StatusPillTone.Success}>{IDENTITY_KEYS_COPY.active}</StatusPill>
  if (!active) statusPill = <StatusPill tone={StatusPillTone.Inactive}>{IDENTITY_KEYS_COPY.disabled}</StatusPill>
  else if (expired) statusPill = <StatusPill tone={StatusPillTone.Warning}>{IDENTITY_KEYS_COPY.expired}</StatusPill>

  return (
    <div className={`grid min-h-12 items-center gap-3 border-t border-dash-primary-dark-blue/10 dark:border-white/10 px-2.5 py-2.5 ${IDENTITY_KEY_TABLE_GRID} ${active ? '' : 'opacity-50'}`}>
      <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>{identityKey.keyId}</Text>
      <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{keyLabel(identityKey.purpose, IDENTITY_KEY_PURPOSE_LABELS)}</Text>
      <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{keyLabel(identityKey.securityLevel, IDENTITY_KEY_LEVEL_LABELS)}</Text>
      <Text size={14} weight={'medium'} color={'brand'} className={'truncate'}>{keyLabel(identityKey.keyType, IDENTITY_KEY_TYPE_LABELS)}</Text>
      <div className={'flex min-w-0 items-center'}>{boundsCell}</div>
      <div className={'flex min-w-0 items-center'}>{limitsCell}</div>
      <div className={'flex justify-start'}>{statusPill}</div>
      <div className={'flex justify-end'}>
        {action != null && (
          <button type={'button'} className={CHIP_ACTION} onClick={() => onAction(identityKey, action)}>
            {IDENTITY_KEY_UPDATE_COPY[action].action}
          </button>
        )}
      </div>
    </div>
  )
}
