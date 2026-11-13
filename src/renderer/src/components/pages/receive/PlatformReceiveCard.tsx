import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import PlatformUnlockTab from '@renderer/components/pages/addresses/PlatformUnlockTab'
import NoResults from '@renderer/components/ui/NoResults'
import RetryButton from '@renderer/components/ui/RetryButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { toast } from '@renderer/components/ui/Toast'
import { receiveCardCopy } from '@renderer/constants'
import { RECEIVE_EMPTY_TEXTS } from '@renderer/constants/receiveCard'
import { RECEIVE_HISTORY_COPY } from '@renderer/constants/receivePage'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { refreshPlatformAddresses, usePlatformAddresses } from '@renderer/hooks/usePlatformAddresses'
import {
  addReceiveRequest,
  deleteReceiveRequest,
  refreshReceiveRequests,
  useReceiveRequests,
} from '@renderer/hooks/useReceiveRequests'
import type { PlatformReceiveCardProps, ReceiveRequestDto } from '@renderer/types/ReceiveRequest'
import {
  claimedReceiveAddresses,
  defaultReceivePlatformAddress,
  nextReceivePlatformAddress,
  receivePlatformAddresses,
} from '@renderer/utils/receiveDefaults'
import { receiveAmountDuffs } from '@renderer/utils/receiveInvoice'
import ReceiveRequestForm from './ReceiveRequestForm'
import ReceiveRequestModal from './ReceiveRequestModal'
import ReceiveRequestsTable from './ReceiveRequestsTable'

export default function PlatformReceiveCard({ walletId }: PlatformReceiveCardProps): React.JSX.Element {
  const { platformAddresses, loading, err } = usePlatformAddresses(walletId)
  const {
    requests,
    loading: requestsLoading,
    err: requestsErr,
  } = useReceiveRequests(walletId, 'platform')
  const claimed = useMemo(() => claimedReceiveAddresses(requests), [requests])

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<ReceiveRequestDto | null>(null)

  if (loading && platformAddresses.length === 0) {
    return <ListSkeleton rows={2} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (err) {
    return (
      <NoResults
        tone={NoResultsTone.Error}
        noResults={RECEIVE_EMPTY_TEXTS.platformLoadFailed}
        action={walletId !== undefined && <RetryButton onRetry={() => refreshPlatformAddresses(walletId)} />}
      />
    )
  }

  if (platformAddresses.length === 0) {
    return <PlatformUnlockTab walletId={walletId} />
  }

  const receiveAddresses = receivePlatformAddresses(platformAddresses)
  const currentAddress = nextReceivePlatformAddress(platformAddresses, claimed)?.platformAddress
    ?? (derivedAddress && !claimed.has(derivedAddress) ? derivedAddress : null)
    ?? defaultReceivePlatformAddress(platformAddresses)?.platformAddress
    ?? receiveAddresses[0]?.platformAddress

  if (!currentAddress) {
    return <NoResults noResults={RECEIVE_EMPTY_TEXTS.noPlatformAddresses} />
  }

  const handleClear = (): void => {
    setLabel('')
    setAmount('')
    setFormError(null)
  }

  const handleSave = async (): Promise<void> => {
    if (!walletId || busy) return
    setBusy(true)
    setFormError(null)
    try {
      await addReceiveRequest(
        walletId,
        currentAddress,
        label,
        receiveAmountDuffs(amount),
      )
      const nextClaimed = new Set(claimed)
      nextClaimed.add(currentAddress)
      let nextUnused = nextReceivePlatformAddress(platformAddresses, nextClaimed)?.platformAddress
      if (!nextUnused) {
        const nextList = await API.addPlatformAddress(walletId)
        nextUnused = nextReceivePlatformAddress(nextList, nextClaimed)?.platformAddress
          ?? nextList[nextList.length - 1]?.platformAddress
        if (nextUnused) setDerivedAddress(nextUnused)
      }
      await refreshPlatformAddresses(walletId)
      setLabel('')
      setAmount('')
    } catch (error) {
      const message = error instanceof Error ? error.message : RECEIVE_HISTORY_COPY.requestFailed
      setFormError(message)
      toast.error(RECEIVE_HISTORY_COPY.requestFailed)
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (request: ReceiveRequestDto): Promise<void> => {
    if (!walletId) return
    try {
      await deleteReceiveRequest(walletId, request.id)
      void refreshPlatformAddresses(walletId)
      if (selectedRequest?.id === request.id) setSelectedRequest(null)
      toast.success(RECEIVE_HISTORY_COPY.deleteSuccess)
    } catch {
      toast.error(RECEIVE_HISTORY_COPY.deleteFailed)
    }
  }

  return (
    <div className={"flex flex-col gap-6 w-full"}>
      <ReceiveRequestForm
        address={currentAddress}
        kind={"platform"}
        label={label}
        amount={amount}
        busy={busy}
        error={formError}
        submitDisabled={!walletId}
        note={
          <Text size={12} weight={"medium"} color={"brand"} opacity={50}>
            {receiveCardCopy.platformNote}
          </Text>
        }
        onLabelChange={(val) => {
          setFormError(null)
          setLabel(val)
        }}
        onAmountChange={(val) => {
          setFormError(null)
          setAmount(val)
        }}
        onClear={handleClear}
        onSubmit={handleSave}
      />

      <ReceiveRequestsTable
        requests={requests}
        loading={requestsLoading}
        error={requestsErr}
        onSelect={setSelectedRequest}
        onDelete={handleDelete}
        onRetry={walletId ? () => refreshReceiveRequests(walletId) : undefined}
      />

      <ReceiveRequestModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  )
}
