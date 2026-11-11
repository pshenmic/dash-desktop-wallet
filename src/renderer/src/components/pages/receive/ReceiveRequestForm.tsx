import { useId, useState } from 'react'
import { Button, CheckIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { CopyIcon2 } from '@renderer/components/dash-ui-kit-extended/icons'
import { toast } from '@renderer/components/ui/Toast'
import { DASH_UNIT } from '@renderer/constants/balance'
import { RECEIVE_INVOICE_ADDRESS_LABELS } from '@renderer/constants/receiveInvoice'
import {
  RECEIVE_FORM_COPY,
  RECEIVE_HISTORY_COPY,
  RECEIVE_LABEL_MAX_LENGTH,
  RECEIVE_MODAL_COPY,
} from '@renderer/constants/receivePage'
import { SEND_AMOUNT_PATTERN } from '@renderer/constants/sendRecipients'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import type { ReceiveRequestFormProps } from '@renderer/types/ReceiveRequest'
import { balancedAddressLines, corePaymentUri, receiveAmountParam } from '@renderer/utils/receiveInvoice'
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
  const [copied, setCopied] = useState(false)
  const hasValues = label.trim().length > 0 || amount.trim().length > 0
  const amountParam = receiveAmountParam(amount)
  const trimmedLabel = label.trim() || null
  const paymentUri = corePaymentUri(address, amountParam, trimmedLabel)
  const addressLines = balancedAddressLines(address)

  const handleCopyAddress = (): void => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      toast.success(RECEIVE_MODAL_COPY.copiedAddress)
      setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }

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
      <div className={"flex w-52 shrink-0 flex-col items-center gap-3"}>
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

        <button
          type={"button"}
          onClick={handleCopyAddress}
          title={RECEIVE_HISTORY_COPY.copyAddressAction}
          aria-label={RECEIVE_HISTORY_COPY.copyAddressAction}
          className={"group flex w-full items-center justify-between gap-2.5 rounded-[.875rem] dash-block px-3.5 py-2.5 text-left cursor-pointer hover:dash-block-accent-10 transition-colors duration-200"}
        >
          <span className={"flex min-w-0 flex-1 flex-col font-mono text-[0.6875rem] font-medium leading-[145%] tracking-[0.01em] dash-text-default"}>
            {addressLines.map((line, index) => (
              <span key={index} className={"block truncate"}>
                {line}
              </span>
            ))}
          </span>
          {copied ? (
            <CheckIcon size={15} className={"shrink-0 text-dash-brand dark:text-dash-mint [&_circle]:hidden"} />
          ) : (
            <CopyIcon2
              size={15}
              color={"currentColor"}
              className={"shrink-0 dash-text-default opacity-50 group-hover:opacity-100 group-hover:text-dash-brand dark:group-hover:text-dash-mint transition-all duration-200"}
            />
          )}
        </button>
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
