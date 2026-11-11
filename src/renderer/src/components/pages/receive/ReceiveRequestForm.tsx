import { useId } from 'react'
import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import { ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { DASH_UNIT } from '@renderer/constants/balance'
import { RECEIVE_INVOICE_ADDRESS_LABELS } from '@renderer/constants/receiveInvoice'
import { RECEIVE_FORM_COPY, RECEIVE_LABEL_MAX_LENGTH } from '@renderer/constants/receivePage'
import { SEND_AMOUNT_PATTERN } from '@renderer/constants/sendRecipients'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import type { ReceiveRequestFormProps } from '@renderer/types/ReceiveRequest'
import { corePaymentUri, receiveAmountParam } from '@renderer/utils/receiveInvoice'
import ReceiveQr from './ReceiveQr'

export default function ReceiveRequestForm({
  address,
  kind,
  label,
  amount,
  busy = false,
  error = null,
  headerExtra,
  extraFields,
  note,
  submitDisabled = false,
  submitLabel,
  onLabelChange,
  onAmountChange,
  onClear,
  onSubmit,
}: ReceiveRequestFormProps): React.JSX.Element {
  const idPrefix = useId()
  const { status } = useAuth()
  const hasValues = label.trim().length > 0 || amount.trim().length > 0
  const amountParam = receiveAmountParam(amount)
  const trimmedLabel = label.trim() || null
  const paymentUri = corePaymentUri(address, amountParam, trimmedLabel)

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (busy || submitDisabled) return
    onSubmit()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex w-full items-center gap-8 ${SURFACE_SECTION}`}
    >
      <div className={"flex w-64 shrink-0 flex-col items-center gap-3"}>
        <ReceiveQr
          value={paymentUri}
          invoice={{
            addressLabel: RECEIVE_INVOICE_ADDRESS_LABELS[kind],
            address,
            label: trimmedLabel,
            amount: amountParam,
            paymentLink: amountParam == null && trimmedLabel == null ? null : paymentUri,
            network: status?.network ?? null,
          }}
        />

        <div className={"flex w-full items-center justify-between gap-2 rounded-[.75rem] dash-block px-3 py-2"}>
          <HighlightedIdentifier className={`${ADDRESS_ROW_IDENTIFIER_CLASS} text-center`}>
            {address}
          </HighlightedIdentifier>
          <CopyButton text={address} className={"shrink-0"} />
        </div>
      </div>

      <div className={"flex min-w-0 flex-1 flex-col gap-3.5"}>
        {headerExtra && (
          <div className={"flex items-center justify-between gap-3"}>
            {headerExtra}
          </div>
        )}

        <label htmlFor={`${idPrefix}-label`} className={"flex flex-col gap-1.5"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {RECEIVE_FORM_COPY.labelField}
          </Text>
          <input
            id={`${idPrefix}-label`}
            type={"text"}
            maxLength={RECEIVE_LABEL_MAX_LENGTH}
            placeholder={RECEIVE_FORM_COPY.labelPlaceholder}
            value={label}
            disabled={busy}
            onChange={(e) => onLabelChange(e.target.value)}
            className={"w-full rounded-[.875rem] dash-block px-4 py-3 text-sm font-medium dash-text-default outline-none placeholder:text-current placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint disabled:opacity-50"}
          />
        </label>

        <label htmlFor={`${idPrefix}-amount`} className={"flex flex-col gap-1.5"}>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {RECEIVE_FORM_COPY.amountField}
          </Text>
          <div className={"relative flex items-center"}>
            <input
              id={`${idPrefix}-amount`}
              type={"text"}
              inputMode={"decimal"}
              placeholder={RECEIVE_FORM_COPY.amountPlaceholder}
              value={amount}
              disabled={busy}
              onChange={(e) => {
                const next = e.target.value.replace(/[^0-9.]/g, '')
                if (SEND_AMOUNT_PATTERN.test(next)) onAmountChange(next)
              }}
              className={"w-full rounded-[.875rem] dash-block pl-4 pr-14 py-3 text-sm font-medium dash-text-default outline-none placeholder:text-current placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint disabled:opacity-50"}
            />
            <Text size={12} weight={"bold"} color={"brand"} opacity={40} className={"pointer-events-none absolute right-4"}>
              {DASH_UNIT}
            </Text>
          </div>
        </label>

        {extraFields}

        {error && (
          <Text size={12} weight={"medium"} color={"red"}>
            {error}
          </Text>
        )}

        <div className={"mt-1 flex flex-wrap items-center justify-between gap-3"}>
          <div className={"flex items-center gap-2.5"}>
            <Button
              type={"submit"}
              disabled={busy || submitDisabled}
              variant={"solid"}
              colorScheme={"primary"}
              size={"compact"}
            >
              {busy ? RECEIVE_FORM_COPY.generatingButton : (submitLabel ?? RECEIVE_FORM_COPY.generateButton)}
            </Button>

            {hasValues && (
              <Button
                type={"button"}
                onClick={onClear}
                disabled={busy}
                variant={"solid"}
                colorScheme={"lightBlue-mint"}
                size={"compact"}
              >
                {RECEIVE_FORM_COPY.clearButton}
              </Button>
            )}
          </div>

          {note}
        </div>
      </div>
    </form>
  )
}
