import { useEffect, useState } from 'react'
import { Button, ExternalLinkIcon, HighlightedIdentifier, KeyIcon, LockIcon, PencilIcon, Text, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import QrButton from '@renderer/components/ui/QrButton'
import SensitiveValue from '@renderer/components/ui/SensitiveValue'
import { toast } from '@renderer/components/ui/Toast'
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES } from '@renderer/constants/addressField'
import {
  ADDRESS_ROW_ADD_LABEL,
  ADDRESS_ROW_DISABLED_ICON_BUTTON_CLASS,
  ADDRESS_ROW_EDIT_LABEL,
  ADDRESS_ROW_EXPLORER_LABEL,
  ADDRESS_ROW_EXPORT_KEY_LABEL,
  ADDRESS_ROW_FIAT_CLASS,
  ADDRESS_ROW_ICON_BUTTON_CLASS,
  ADDRESS_ROW_IDENTIFIER_CLASS,
  ADDRESS_ROW_LOCKED_BADGE,
  ADDRESS_ROW_LOCK_LABEL,
  ADDRESS_ROW_UNLOCK_LABEL,
  ADDRESS_ROW_LABEL_LOCKED_TOOLTIP,
  ADDRESS_ROW_LABEL_PLACEHOLDER,
  ADDRESS_ROW_LABEL_SAVE_ERROR,
} from '@renderer/constants/addressRow'
import { RECEIVE_LABEL_MAX_LENGTH } from '@renderer/constants/receivePage'
import { SURFACE_ROW } from '@renderer/constants/surfaces'
import { useFiat } from '@renderer/hooks/useFiat'
import type { AddressRowProps } from '@renderer/types/AddressRow'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { getErrorMessage } from '@renderer/utils/error'
import { openExternal } from '@renderer/utils/explorer'

export default function AddressRow({
  address,
  label = null,
  labelLocked = false,
  labelLockedTooltip = ADDRESS_ROW_LABEL_LOCKED_TOOLTIP,
  onSaveLabel,
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
  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const trimmedLabel = label?.trim() ?? ''
  const lockLabel = isLocked ? ADDRESS_ROW_UNLOCK_LABEL : ADDRESS_ROW_LOCK_LABEL

  useEffect(() => {
    if (labelLocked) setEditing(false)
  }, [labelLocked])

  useEffect(() => {
    setEditing(false)
  }, [address])

  const handleSave = async (): Promise<void> => {
    if (!onSaveLabel || saving) return
    const normalized = draftLabel.trim().slice(0, RECEIVE_LABEL_MAX_LENGTH)
    if (normalized === trimmedLabel) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSaveLabel(normalized)
      setEditing(false)
    } catch (error) {
      toast.error(`**${ADDRESS_ROW_LABEL_SAVE_ERROR}** ${getErrorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`flex items-center justify-between gap-4 ${SURFACE_ROW}`}>
      <div className={"flex min-w-0 flex-1 items-center gap-2"}>
        {leading}
        <div className={"flex min-w-0 flex-1 flex-col gap-1"}>
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
            {labelLocked ? (
              <Tooltip label={labelLockedTooltip}>
                <span className={"inline-flex shrink-0"}>
                  <button
                    type={"button"}
                    disabled
                    aria-label={labelLockedTooltip}
                    className={ADDRESS_ROW_DISABLED_ICON_BUTTON_CLASS}
                  >
                    <PencilIcon size={10} color={"currentColor"} className={"dash-text-default"} />
                  </button>
                </span>
              </Tooltip>
            ) : onSaveLabel && !editing && (
              <Tooltip label={trimmedLabel !== '' ? ADDRESS_ROW_EDIT_LABEL : ADDRESS_ROW_ADD_LABEL}>
                <button
                  type={"button"}
                  onClick={() => {
                    setDraftLabel(trimmedLabel)
                    setEditing(true)
                  }}
                  aria-label={trimmedLabel !== '' ? ADDRESS_ROW_EDIT_LABEL : ADDRESS_ROW_ADD_LABEL}
                  className={ADDRESS_ROW_ICON_BUTTON_CLASS}
                >
                  <PencilIcon size={10} color={"currentColor"} className={"dash-text-default opacity-50"} />
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
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSave()
              }}
              className={"mt-1 flex flex-wrap items-center gap-2"}
            >
              <div className={"flex h-8 min-w-48 max-w-72 flex-1 items-center rounded-[.625rem] border border-transparent dash-block-5 px-2.5 focus-within:border-dash-brand dark:focus-within:border-dash-mint"}>
                <input
                  type={"text"}
                  aria-label={ADDRESS_ROW_EDIT_LABEL}
                  maxLength={RECEIVE_LABEL_MAX_LENGTH}
                  value={draftLabel}
                  disabled={saving}
                  autoFocus
                  onChange={e => setDraftLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditing(false)
                    }
                  }}
                  placeholder={ADDRESS_ROW_LABEL_PLACEHOLDER}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[12]}`}
                />
              </div>
              <Button
                type={"submit"}
                size={"compact"}
                colorScheme={"primary"}
                disabled={saving}
                className={"h-8! px-3! text-xs! normal-case!"}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type={"button"}
                size={"compact"}
                colorScheme={"primary-light"}
                disabled={saving}
                onClick={() => setEditing(false)}
                className={"h-8! px-3! text-xs! normal-case!"}
              >
                Cancel
              </Button>
            </form>
          )}
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
