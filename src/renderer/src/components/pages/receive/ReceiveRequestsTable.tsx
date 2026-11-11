import {
  ChainSmallIcon,
  DeleteIcon,
  HighlightedIdentifier,
  Text,
  Tooltip,
} from '@renderer/components/dash-ui-kit-extended'
import { DollarIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import CopyButton from '@renderer/components/ui/CopyButton'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DashBigNumber from '@renderer/components/ui/DashBigNumber'
import NoResults from '@renderer/components/ui/NoResults'
import QrButton from '@renderer/components/ui/QrButton'
import RetryButton from '@renderer/components/ui/RetryButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { toast } from '@renderer/components/ui/Toast'
import { ADDRESS_ROW_FIAT_CLASS, ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { DASH_UNIT } from '@renderer/constants/balance'
import { RECEIVE_HISTORY_COPY, RECEIVE_MODAL_COPY } from '@renderer/constants/receivePage'
import { SURFACE_ROW } from '@renderer/constants/surfaces'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { useFiat } from '@renderer/hooks/useFiat'
import type { ReceiveRequestsTableProps } from '@renderer/types/ReceiveRequest'
import { formatApproxFiat } from '@renderer/utils/approxFiat'
import { corePaymentUri, receiveRequestAmountDash } from '@renderer/utils/receiveInvoice'

export default function ReceiveRequestsTable({
  requests,
  loading = false,
  error = null,
  onSelect,
  onDelete,
  onRetry,
}: ReceiveRequestsTableProps): React.JSX.Element {
  const { format: formatFiat, rateReady } = useFiat()

  const copyText = (text: string, message: string): void => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(message)
    }).catch(() => {})
  }

  return (
    <div className={"flex flex-col gap-3 w-full"}>
      <div className={"flex items-center gap-2"}>
        <Text size={14} weight={"extrabold"} color={"brand"}>
          {RECEIVE_HISTORY_COPY.title}
        </Text>
        {requests.length > 0 && (
          <CustomBadge text={String(requests.length)} variant={"muted"} size={"xs"} />
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={3} rowClassName="h-[3rem] rounded-[.875rem]" />
      ) : error ? (
        <NoResults
          tone={NoResultsTone.Error}
          noResults={RECEIVE_HISTORY_COPY.loadFailed}
          action={onRetry && <RetryButton onRetry={onRetry} />}
        />
      ) : requests.length === 0 ? (
        <NoResults noResults={RECEIVE_HISTORY_COPY.empty} />
      ) : (
        <div className={"flex flex-col gap-[.5rem]"}>
          <div className={"grid grid-cols-[9rem_minmax(7rem,1fr)_minmax(14rem,1.8fr)_minmax(8.5rem,1fr)_auto] items-center gap-3 px-4 py-1"}>
            <Text size={10} weight={"bold"} color={"brand"} opacity={50}>
              {RECEIVE_HISTORY_COPY.dateHeader}
            </Text>
            <Text size={10} weight={"bold"} color={"brand"} opacity={50}>
              {RECEIVE_HISTORY_COPY.labelHeader}
            </Text>
            <Text size={10} weight={"bold"} color={"brand"} opacity={50}>
              {RECEIVE_HISTORY_COPY.addressHeader}
            </Text>
            <Text size={10} weight={"bold"} color={"brand"} opacity={50}>
              {RECEIVE_HISTORY_COPY.amountHeader}
            </Text>
            <Text size={10} weight={"bold"} color={"brand"} opacity={50} className={"text-right"}>
              {RECEIVE_HISTORY_COPY.actionsHeader}
            </Text>
          </div>

          {requests.map((request) => {
            const amountDash = receiveRequestAmountDash(request.amountDuffs)
            const paymentUri = corePaymentUri(request.address, amountDash, request.label)
            const formattedDate = new Date(request.createdAt).toLocaleString(undefined, {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <div
                key={request.id}
                onClick={() => onSelect(request)}
                role={"button"}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(request)
                  }
                }}
                className={`grid grid-cols-[9rem_minmax(7rem,1fr)_minmax(14rem,1.8fr)_minmax(8.5rem,1fr)_auto] items-center gap-3 cursor-pointer hover:dash-block-accent-10 transition-colors duration-150 ${SURFACE_ROW}`}
              >
                <Text size={12} weight={"medium"} color={"brand"} opacity={60} className={"truncate font-mono text-[0.75rem]!"}>
                  {formattedDate}
                </Text>

                {request.label ? (
                  <Text size={12} weight={"bold"} color={"brand"} className={"truncate"}>
                    {request.label}
                  </Text>
                ) : (
                  <Text size={12} weight={"medium"} color={"brand"} opacity={40} className={"truncate"}>
                    {RECEIVE_HISTORY_COPY.noLabel}
                  </Text>
                )}

                <div className={"flex min-w-0 items-center"}>
                  <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>
                    {request.address}
                  </HighlightedIdentifier>
                </div>

                {amountDash !== null && request.amountDuffs !== null ? (
                  <div className={"flex min-w-0 flex-wrap items-baseline gap-1.5"}>
                    <Text size={12} weight={"bold"} color={"brand"}>
                      <DashBigNumber>{amountDash}</DashBigNumber>
                      <span className={"font-normal"}>{` ${DASH_UNIT}`}</span>
                    </Text>
                    {rateReady && (
                      <span className={ADDRESS_ROW_FIAT_CLASS}>
                        {formatApproxFiat(formatFiat(request.amountDuffs))}
                      </span>
                    )}
                  </div>
                ) : (
                  <Text size={12} weight={"medium"} color={"brand"} opacity={40} className={"truncate"}>
                    {RECEIVE_HISTORY_COPY.noAmount}
                  </Text>
                )}

                <div
                  className={"flex items-center justify-end gap-1.5"}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tooltip label={RECEIVE_HISTORY_COPY.showAction}>
                    <span>
                      <QrButton
                        onClick={() => onSelect(request)}
                        ariaLabel={RECEIVE_HISTORY_COPY.showAction}
                      />
                    </span>
                  </Tooltip>

                  <Tooltip label={RECEIVE_HISTORY_COPY.copyAddressAction}>
                    <span>
                      <CopyButton text={request.address} />
                    </span>
                  </Tooltip>

                  <Tooltip label={RECEIVE_HISTORY_COPY.copyLinkAction}>
                    <button
                      type={"button"}
                      aria-label={RECEIVE_HISTORY_COPY.copyLinkAction}
                      onClick={() => copyText(paymentUri, RECEIVE_MODAL_COPY.copiedUri)}
                      className={"size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer"}
                    >
                      <ChainSmallIcon size={12} color={"currentColor"} className={"dash-text-default opacity-50"} />
                    </button>
                  </Tooltip>

                  <Tooltip label={RECEIVE_HISTORY_COPY.copyAmountAction}>
                    <button
                      type={"button"}
                      aria-label={RECEIVE_HISTORY_COPY.copyAmountAction}
                      disabled={amountDash === null}
                      onClick={() => {
                        if (amountDash !== null) copyText(amountDash, RECEIVE_MODAL_COPY.copiedAmount)
                      }}
                      className={"size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-25"}
                    >
                      <DollarIcon size={8} color={"currentColor"} className={"dash-text-default opacity-50"} />
                    </button>
                  </Tooltip>

                  <Tooltip label={RECEIVE_HISTORY_COPY.deleteAction}>
                    <button
                      type={"button"}
                      aria-label={RECEIVE_HISTORY_COPY.deleteAction}
                      onClick={() => onDelete(request)}
                      className={"size-5 rounded-[.3125rem] flex items-center justify-center dash-block-5 hover:opacity-80 transition-opacity duration-200 cursor-pointer"}
                    >
                      <DeleteIcon size={10} color={"currentColor"} className={"dash-text-default opacity-50"} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
