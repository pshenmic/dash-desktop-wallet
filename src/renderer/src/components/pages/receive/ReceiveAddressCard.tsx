import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { InfoTooltip, Text } from '@renderer/components/dash-ui-kit-extended'
import Checkbox from '@renderer/components/ui/Checkbox'
import NoResults from '@renderer/components/ui/NoResults'
import { toast } from '@renderer/components/ui/Toast'
import { ADDRESS_LOCK_TOGGLE_FAILED } from '@renderer/constants/addressRow'
import { RECEIVE_EMPTY_TEXTS } from '@renderer/constants/receiveCard'
import { RECEIVE_FORM_COPY, RECEIVE_HISTORY_COPY } from '@renderer/constants/receivePage'
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
  const [lockIncoming, setLockIncoming] = useState(false)
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
    setLockIncoming(false)
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
      if (lockIncoming) {
        await API.setAddressLocked(walletId, currentAddress, true)
      }
      const nextClaimed = new Set(claimed)
      nextClaimed.add(currentAddress)
      const nextAddresses = lockIncoming
        ? addresses.map(entry => (entry.address === currentAddress ? { ...entry, isLocked: true } : entry))
        : addresses
      const nextDefault = lockIncoming && currentAddress === defaultAddress ? null : defaultAddress
      const nextUnused = nextReceiveCoreAddress(nextAddresses, nextClaimed, nextDefault)
      if (!nextUnused) {
        const fresh = await API.addWalletAddress(walletId, false)
        setDerivedAddress(fresh)
      }
      invalidateAsyncCache('receiveAddress', walletId)
      await refreshAddresses(walletId)
      setLabel('')
      setAmount('')
      setLockIncoming(false)
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
        hasExtraValues={lockIncoming}
        extraFields={walletId != null ? (
          <div className={'flex items-center gap-1.5'}>
            <Checkbox
              appearance={'subtle'}
              checked={lockIncoming}
              disabled={busy}
              onChange={(checked) => {
                setFormError(null)
                setLockIncoming(checked)
              }}
              label={(
                <Text size={12} weight={'medium'} color={'brand'}>
                  {RECEIVE_FORM_COPY.lockIncomingLabel}
                </Text>
              )}
            />
            <InfoTooltip
              content={RECEIVE_FORM_COPY.lockIncomingTooltip}
              ariaLabel={RECEIVE_FORM_COPY.lockIncomingTooltipAria}
              side={'right'}
              className={'size-4! [&_svg]:size-3.5'}
            />
          </div>
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
