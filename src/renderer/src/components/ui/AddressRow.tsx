import { HighlightedIdentifier, Text, ExternalLinkIcon, KeyIcon, LockIcon, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import QrButton from '@renderer/components/ui/QrButton'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import {
  ADDRESS_ROW_EXPLORER_LABEL,
  ADDRESS_ROW_EXPORT_KEY_LABEL,
  ADDRESS_ROW_FIAT_CLASS,
  ADDRESS_ROW_ICON_BUTTON_CLASS,
  ADDRESS_ROW_IDENTIFIER_CLASS,
  ADDRESS_ROW_LOCKED_BADGE,
  ADDRESS_ROW_LOCK_LABEL,
  ADDRESS_ROW_UNLOCK_LABEL,
} from '@renderer/constants/addressRow'
import { SURFACE_ROW } from '@renderer/constants/surfaces'
import { useFiat } from '@renderer/hooks/useFiat'
import type { AddressRowProps } from '@renderer/types/AddressRow'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { openExternal } from '@renderer/utils/explorer'

export default function AddressRow({
  address,
  label = null,
  amount,
  fiatDuffs = null,
  leading,
  meta,
  explorerUrl,
  onQr,
  onExportKey,
  isLocked = false,
  lockBusy = false,
  onToggleLock,
  hidden = false,
}: AddressRowProps): React.JSX.Element {
  const { format: formatFiat, rateReady } = useFiat()
  const trimmedLabel = label?.trim() ?? ''
  const lockLabel = isLocked ? ADDRESS_ROW_UNLOCK_LABEL : ADDRESS_ROW_LOCK_LABEL

  return (
    <div className={`flex items-center justify-between gap-4 ${SURFACE_ROW}`}>
      <div className={"flex min-w-0 items-center gap-2"}>
        {leading}
        <div className={"flex min-w-0 flex-col gap-1"}>
          <div className={"flex min-w-0 items-center gap-[.3125rem]"}>
            <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>{address}</HighlightedIdentifier>
            {trimmedLabel !== '' && (
              <CustomBadge text={trimmedLabel} variant={"accent"} size={"xs"} className={"shrink-0"} />
            )}
            {isLocked && (
              <CustomBadge text={ADDRESS_ROW_LOCKED_BADGE} variant={"warning"} size={"xs"} className={"shrink-0"} />
            )}
            <CopyButton text={address} className={"shrink-0"} />
            {onQr && <QrButton onClick={onQr} className={"shrink-0"} />}
            {onToggleLock && (
              <Tooltip label={lockLabel}>
                <button
                  type={"button"}
                  disabled={lockBusy}
                  onClick={onToggleLock}
                  title={lockLabel}
                  aria-label={`${lockLabel} ${address}`}
                  aria-pressed={isLocked}
                  className={`size-5 shrink-0 rounded-[.3125rem] flex items-center justify-center ${
                    isLocked ? 'dash-block-accent-25 dash-text-primary' : 'dash-block-5 dash-text-default'
                  } hover:opacity-80 transition-opacity duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-40`}
                >
                  <LockIcon size={10} color={"currentColor"} className={isLocked ? '' : 'opacity-50'} />
                </button>
              </Tooltip>
            )}
            {onExportKey && (
              <button
                type={"button"}
                onClick={onExportKey}
                title={ADDRESS_ROW_EXPORT_KEY_LABEL}
                aria-label={ADDRESS_ROW_EXPORT_KEY_LABEL}
                className={ADDRESS_ROW_ICON_BUTTON_CLASS}
              >
                <KeyIcon size={10} color={"currentColor"} className={"dash-text-default opacity-50"} />
              </button>
            )}
            {explorerUrl && (
              <button
                type={"button"}
                onClick={() => openExternal(explorerUrl)}
                title={ADDRESS_ROW_EXPLORER_LABEL}
                aria-label={ADDRESS_ROW_EXPLORER_LABEL}
                className={ADDRESS_ROW_ICON_BUTTON_CLASS}
              >
                <ExternalLinkIcon size={10} color={"currentColor"} className={"dash-text-default opacity-50"} />
              </button>
            )}
          </div>
          {meta}
        </div>
      </div>
      <div className={"flex shrink-0 items-center gap-2"}>
        <SensitiveValue hidden={hidden} size={"card"}>
          <Text size={14} weight={"medium"} color={"brand"}>{amount}</Text>
          {fiatDuffs !== null && rateReady && (
            <span className={ADDRESS_ROW_FIAT_CLASS}>{formatApproxFiat(formatFiat(fiatDuffs))}</span>
          )}
        </SensitiveValue>
      </div>
    </div>
  )
}
