import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import NoResults from '@renderer/components/ui/NoResults'
import { toast } from '@renderer/components/ui/Toast'
import { RECEIVE_EMPTY_TEXTS } from '@renderer/constants/receiveCard'
import { RECEIVE_HISTORY_COPY } from '@renderer/constants/receivePage'
import { refreshAddresses } from '@renderer/hooks/useAdresses'
import {
  addReceiveRequest,
  deleteReceiveRequest,
  refreshReceiveRequests,
  useReceiveRequests,
} from '@renderer/hooks/useReceiveRequests'
import type { ReceiveAddressCardProps, ReceiveRequestDto } from '@renderer/types/ReceiveRequest'
import {
  claimedReceiveAddresses,
  nextReceiveCoreAddress,
  receiveCoreAddresses,
} from '@renderer/utils/receiveDefaults'
import { receiveAmountDuffs } from '@renderer/utils/receiveInvoice'
import ReceiveRequestForm from './ReceiveRequestForm'
import ReceiveRequestModal from './ReceiveRequestModal'
import ReceiveRequestsTable from './ReceiveRequestsTable'

export default function ReceiveAddressCard({
  walletId,
  addresses,
  defaultAddress,
}: ReceiveAddressCardProps): React.JSX.Element {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [derivedAddress, setDerivedAddress] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<ReceiveRequestDto | null>(null)

  const { requests, loading, err } = useReceiveRequests(walletId, 'core')
  const claimed = useMemo(() => claimedReceiveAddresses(requests), [requests])
  const current = useMemo(
    () => nextReceiveCoreAddress(addresses, claimed, defaultAddress),
    [addresses, claimed, defaultAddress],
  )
  const currentAddress = current?.address
    ?? (derivedAddress && !claimed.has(derivedAddress) ? derivedAddress : null)
    ?? (defaultAddress && !claimed.has(defaultAddress) ? defaultAddress : null)
    ?? receiveCoreAddresses(addresses)[0]?.address
    ?? defaultAddress

  if (!currentAddress) {
    return <NoResults noResults={RECEIVE_EMPTY_TEXTS.noCoreAddresses} />
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
      const nextClaimed = new Set(claimed)
      nextClaimed.add(currentAddress)
      const nextUnused = nextReceiveCoreAddress(addresses, nextClaimed, defaultAddress)
      if (!nextUnused) {
        const fresh = await API.addWalletAddress(walletId, false)
        setDerivedAddress(fresh)
        await refreshAddresses(walletId)
      }
      addReceiveRequest(
        walletId,
        'core',
        currentAddress,
        label,
        receiveAmountDuffs(amount),
      )
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

  const handleDelete = (request: ReceiveRequestDto): void => {
    if (!walletId) return
    deleteReceiveRequest(walletId, request.id)
    if (selectedRequest?.id === request.id) setSelectedRequest(null)
    toast.success(RECEIVE_HISTORY_COPY.deleteSuccess)
  }

  return (
    <div className={"flex flex-col gap-6 w-full"}>
      <ReceiveRequestForm
        address={currentAddress}
        kind={"core"}
        label={label}
        amount={amount}
        busy={busy}
        error={formError}
        submitDisabled={!walletId}
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
        loading={loading}
        error={err}
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
