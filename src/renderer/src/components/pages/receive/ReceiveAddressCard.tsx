import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { LockIcon, Tooltip } from '@renderer/components/dash-ui-kit-extended'
import NoResults from '@renderer/components/ui/NoResults'
import { toast } from '@renderer/components/ui/Toast'
import {
  ADDRESS_LOCK_TOGGLE_FAILED,
  ADDRESS_ROW_LOCK_LABEL,
} from '@renderer/constants/addressRow'
import { RECEIVE_EMPTY_TEXTS } from '@renderer/constants/receiveCard'
import { RECEIVE_HISTORY_COPY } from '@renderer/constants/receivePage'
import { CHIP_ACTION } from '@renderer/constants/surfaces'
import { refreshAddresses } from '@renderer/hooks/useAdresses'
import { invalidateAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import {
  addReceiveRequest,
  deleteReceiveRequest,
  refreshReceiveRequests,
  useReceiveRequests,
} from '@renderer/hooks/useReceiveRequests'
import type { ReceiveAddressCardProps, ReceiveRequestDto } from '@renderer/types/ReceiveRequest'
import {
  lockedAddressSet,
  resolveActiveReceiveCoreAddress,
  toggleWalletAddressLock,
} from '@renderer/utils/addressLock'
import {
  claimedReceiveAddresses,
  nextReceiveCoreAddress,
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
  const [lockingAddress, setLockingAddress] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<ReceiveRequestDto | null>(null)

  const { requests, loading, err } = useReceiveRequests(walletId, 'core')
  const claimed = useMemo(() => claimedReceiveAddresses(requests), [requests])
  const lockedAddresses = useMemo(() => lockedAddressSet(addresses), [addresses])
  const currentAddress = useMemo(
    () => resolveActiveReceiveCoreAddress({ addresses, claimed, defaultAddress, derivedAddress }),
    [addresses, claimed, defaultAddress, derivedAddress],
  )

  if (!currentAddress) {
    return <NoResults noResults={RECEIVE_EMPTY_TEXTS.noCoreAddresses} />
  }

  const handleClear = (): void => {
    setLabel('')
    setAmount('')
    setFormError(null)
  }

  const handleToggleAddressLock = async (address: string, nextLocked: boolean): Promise<void> => {
    if (!walletId || lockingAddress != null) return
    setLockingAddress(address)
    try {
      await toggleWalletAddressLock(walletId, address, nextLocked)
      if (nextLocked) {
        const afterLock = addresses.map(entry => (entry.address === address ? { ...entry, isLocked: true } : entry))
        const nextAvailable = resolveActiveReceiveCoreAddress({
          addresses: afterLock,
          claimed,
          defaultAddress: address === defaultAddress ? null : defaultAddress,
          derivedAddress: address === derivedAddress ? null : derivedAddress,
        })
        if (nextAvailable == null) {
          const fresh = await API.addWalletAddress(walletId, false)
          setDerivedAddress(fresh)
          invalidateAsyncCache('receiveAddress', walletId)
          await refreshAddresses(walletId)
        }
      }
    } catch {
      toast.error(ADDRESS_LOCK_TOGGLE_FAILED)
    } finally {
      setLockingAddress(null)
    }
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
      const nextUnused = nextReceiveCoreAddress(addresses, nextClaimed, defaultAddress)
      if (!nextUnused) {
        const fresh = await API.addWalletAddress(walletId, false)
        setDerivedAddress(fresh)
      }
      invalidateAsyncCache('receiveAddress', walletId)
      await refreshAddresses(walletId)
      setLabel('')
      setAmount('')
      toast.success(RECEIVE_HISTORY_COPY.requestCreated)
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
      invalidateAsyncCache('receiveAddress', walletId)
      void refreshAddresses(walletId)
      if (selectedRequest?.id === request.id) setSelectedRequest(null)
      toast.success(RECEIVE_HISTORY_COPY.deleteSuccess)
    } catch {
      toast.error(RECEIVE_HISTORY_COPY.deleteFailed)
    }
  }

  return (
    <div className={"flex min-w-0 flex-col gap-6 w-full"}>
      <ReceiveRequestForm
        address={currentAddress}
        kind={"core"}
        label={label}
        amount={amount}
        busy={busy}
        error={formError}
        submitDisabled={!walletId}
        headerExtra={walletId != null ? (
          <Tooltip label={ADDRESS_ROW_LOCK_LABEL}>
            <button
              type={'button'}
              disabled={busy || lockingAddress === currentAddress}
              aria-label={`${ADDRESS_ROW_LOCK_LABEL} ${currentAddress}`}
              onClick={() => { void handleToggleAddressLock(currentAddress, true) }}
              className={`ml-auto inline-flex items-center gap-1 ${CHIP_ACTION}`}
            >
              <LockIcon size={10} color={'currentColor'} />
              {ADDRESS_ROW_LOCK_LABEL}
            </button>
          </Tooltip>
        ) : undefined}
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
        lockedAddresses={lockedAddresses}
        lockingAddress={lockingAddress}
        onToggleAddressLock={walletId == null ? undefined : (addr, nextLocked) => { void handleToggleAddressLock(addr, nextLocked) }}
        onSelect={setSelectedRequest}
        onDelete={handleDelete}
        onRetry={walletId ? () => refreshReceiveRequests(walletId) : undefined}
      />

      <ReceiveRequestModal
        request={selectedRequest}
        lockedAddresses={lockedAddresses}
        lockingAddress={lockingAddress}
        onToggleAddressLock={walletId == null ? undefined : (addr, nextLocked) => { void handleToggleAddressLock(addr, nextLocked) }}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  )
}
