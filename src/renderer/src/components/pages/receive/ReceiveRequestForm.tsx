import { useId } from 'react'
import { Button, Text } from '@renderer/components/dash-ui-kit-extended'
import { DASH_UNIT } from '@renderer/constants/balance'
import { RECEIVE_INVOICE_ADDRESS_LABELS } from '@renderer/constants/receiveInvoice'
import { RECEIVE_FORM_COPY, RECEIVE_LABEL_MAX_LENGTH } from '@renderer/constants/receivePage'
import { SEND_AMOUNT_PATTERN } from '@renderer/constants/sendRecipients'
import { FIELD_CONTROL_HEIGHT } from '@renderer/constants/surfaces'
import type { ReceiveRequestFormProps } from '@renderer/types/ReceiveRequest'
import { corePaymentUri, receiveAmountParam } from '@renderer/utils/receiveInvoice'
import ReceiveAddressPanel from './ReceiveAddressPanel'

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
  const disabled = busy || submitDisabled
  const hasValues = label.trim().length > 0 || amount.trim().length > 0
  const amountParam = receiveAmountParam(amount)
  const trimmedLabel = label.trim() || null
  const paymentUri = corePaymentUri(address, amountParam, trimmedLabel)

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (disabled) return
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className={"w-full"}>
      <ReceiveAddressPanel
        address={address}
        wideAddress={kind !== 'core'}
        title={RECEIVE_FORM_COPY.title}
        addressLabel={RECEIVE_INVOICE_ADDRESS_LABELS[kind]}
        addressBadge={headerExtra}
        label={trimmedLabel}
        amount={amountParam}
        paymentLink={paymentUri}
        disabled={disabled}
      >
        <label htmlFor={`${idPrefix}-label`} className={"flex flex-col gap-2"}>
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
            className={`${FIELD_CONTROL_HEIGHT} w-full rounded-[.875rem] dash-block px-4 py-3.5 text-sm font-medium dash-text-default outline-none placeholder:text-current placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint disabled:opacity-50`}
          />
        </label>

        <label htmlFor={`${idPrefix}-amount`} className={"flex flex-col gap-2"}>
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
              className={`${FIELD_CONTROL_HEIGHT} w-full rounded-[.875rem] dash-block pl-4 pr-14 py-3.5 text-sm font-medium dash-text-default outline-none placeholder:text-current placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-dash-brand dark:focus-visible:ring-dash-mint disabled:opacity-50`}
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
              disabled={disabled}
              variant={"solid"}
              colorScheme={"primary"}
              size={"compact"}
              className={"normal-case!"}
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
                className={"normal-case!"}
              >
                {RECEIVE_FORM_COPY.clearButton}
              </Button>
            )}
          </div>

          {note}
        </div>
      </ReceiveAddressPanel>
    </form>
  )
}
