import { Button, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import CopyButton from '@renderer/components/ui/CopyButton'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import HashField from '@renderer/components/ui/HashField'
import Modal from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/Toast'
import { ADDRESS_ROW_FIAT_CLASS, ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { DASH_UNIT } from '@renderer/constants/balance'
import { RECEIVE_INVOICE_ADDRESS_LABELS } from '@renderer/constants/receiveInvoice'
import { RECEIVE_MODAL_COPY } from '@renderer/constants/receivePage'
import { useAuth } from '@renderer/contexts/AuthContext'
import { ModalSize } from '@renderer/enums/ModalSize'
import { useFiat } from '@renderer/hooks/useFiat'
import type { ReceiveRequestModalProps } from '@renderer/types/ReceiveRequest'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { corePaymentUri, receiveRequestAmountDash } from '@renderer/utils/receiveInvoice'
import ReceiveQr from './ReceiveQr'

export default function ReceiveRequestModal({
  request,
  onClose,
}: ReceiveRequestModalProps): React.JSX.Element | null {
  const { status } = useAuth()
  const { format: formatFiat, rateReady } = useFiat()

  if (!request) return null

  const amountDash = receiveRequestAmountDash(request.amountDuffs)
  const paymentUri = corePaymentUri(request.address, amountDash, request.label)
  const modalTitle = request.label
    ? `${RECEIVE_MODAL_COPY.titlePrefix} ${request.label}`
    : RECEIVE_MODAL_COPY.defaultTitle

  const copyWithToast = (text: string, message: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(message)
    }).catch(() => {})
  }

  const modalSize = request.kind === 'shielded' ? ModalSize.Lg : ModalSize.Md

  return (
    <Modal open onClose={onClose} title={modalTitle} size={modalSize}>
      <div className={"mt-4 flex flex-col gap-5"}>
        <div className={"flex flex-col items-center justify-center gap-3 rounded-2xl dash-block p-5"}>
          <ReceiveQr
            value={paymentUri}
            invoice={{
              addressLabel: RECEIVE_INVOICE_ADDRESS_LABELS[request.kind],
              address: request.address,
              label: request.label,
              amount: amountDash,
              paymentLink: paymentUri,
              network: status?.network ?? null,
            }}
          />
          <Text size={10} weight={"medium"} color={"brand"} opacity={60} className={"break-all text-center font-mono"}>
            {request.address}
          </Text>
        </div>

        <div className={"flex flex-col gap-3"}>
          <Text size={12} weight={"bold"} color={"brand"}>
            {RECEIVE_MODAL_COPY.paymentInfo}
          </Text>

          <HashField hash={paymentUri} label={RECEIVE_MODAL_COPY.uriLabel} />

          <div className={"flex flex-col gap-2 rounded-[.875rem] dash-block px-4 py-3"}>
            <div className={"flex items-start justify-between gap-3"}>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"shrink-0"}>
                {RECEIVE_MODAL_COPY.addressLabel}
              </Text>
              <div className={"flex min-w-0 items-center justify-end gap-2"}>
                <HighlightedIdentifier className={`${ADDRESS_ROW_IDENTIFIER_CLASS} text-right`}>
                  {request.address}
                </HighlightedIdentifier>
                <CopyButton text={request.address} className={"shrink-0"} />
              </div>
            </div>

            {request.label && (
              <div className={"flex items-center justify-between gap-3"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                  {RECEIVE_MODAL_COPY.labelField}
                </Text>
                <Text size={12} weight={"bold"} color={"brand"} className={"truncate"}>
                  {request.label}
                </Text>
              </div>
            )}

            {amountDash !== null && request.amountDuffs !== null && (
              <div className={"flex items-center justify-between gap-3"}>
                <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
                  {RECEIVE_MODAL_COPY.amountField}
                </Text>
                <div className={"flex items-center gap-2"}>
                  <Text size={12} weight={"bold"} color={"brand"}>
                    <DashBigNumber>{amountDash}</DashBigNumber>
                    <span className={"font-normal"}>{` ${DASH_UNIT}`}</span>
                  </Text>
                  {rateReady && (
                    <span className={ADDRESS_ROW_FIAT_CLASS}>
                      {formatApproxFiat(formatFiat(request.amountDuffs))}
                    </span>
                  )}
                  <CopyButton text={amountDash} className={"shrink-0"} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={"flex flex-wrap items-center justify-end gap-2.5"}>
          <Button
            type={"button"}
            onClick={() => copyWithToast(paymentUri, RECEIVE_MODAL_COPY.copiedUri)}
            variant={"solid"}
            colorScheme={"primary"}
            size={"compact"}
          >
            {RECEIVE_MODAL_COPY.copyUri}
          </Button>
          <Button
            type={"button"}
            onClick={() => copyWithToast(request.address, RECEIVE_MODAL_COPY.copiedAddress)}
            variant={"solid"}
            colorScheme={"lightBlue-mint"}
            size={"compact"}
          >
            {RECEIVE_MODAL_COPY.copyAddress}
          </Button>
          {amountDash !== null && (
            <Button
              type={"button"}
              onClick={() => copyWithToast(amountDash, RECEIVE_MODAL_COPY.copiedAmount)}
              variant={"solid"}
              colorScheme={"lightBlue-mint"}
              size={"compact"}
            >
              {RECEIVE_MODAL_COPY.copyAmount}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
