import { useEffect, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import { Button, ShieldSmallIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import PasswordField from '@renderer/components/ui/PasswordField'
import ShieldedNotesAlert from '@renderer/components/ui/ShieldedNotesAlert'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { toast } from '@renderer/components/ui/Toast'
import { addressFormCopy, INVALID_WALLET_PASSWORD_MESSAGE, receiveCardCopy } from '@renderer/constants'
import { RECEIVE_HISTORY_COPY } from '@renderer/constants/receivePage'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'
import {
  addReceiveRequest,
  deleteReceiveRequest,
  refreshReceiveRequests,
  useReceiveRequests,
} from '@renderer/hooks/useReceiveRequests'
import { useShieldedSyncState } from '@renderer/hooks/useShielded'
import type { ReceiveRequestDto, ShieldedReceiveCardProps } from '@renderer/types/ReceiveRequest'
import { claimedReceiveAddresses, nextReceiveShieldedAddress } from '@renderer/utils/receiveDefaults'
import { receiveAmountDuffs } from '@renderer/utils/receiveInvoice'
import { shieldedBalancesByAddress } from '@renderer/utils/shieldedBalances'
import ReceiveRequestForm from './ReceiveRequestForm'
import ReceiveRequestModal from './ReceiveRequestModal'
import ReceiveRequestsTable from './ReceiveRequestsTable'

export default function ShieldedReceiveCard({ walletId }: ShieldedReceiveCardProps): React.JSX.Element {
  const [addresses, setAddresses] = useState<string[] | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)

  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedRequest, setSelectedRequest] = useState<ReceiveRequestDto | null>(null)

  const sync = useShieldedSyncState(walletId)
  const synced = sync.phase === ShieldedSyncPhase.Done
  const syncRunning = sync.phase === ShieldedSyncPhase.Syncing || sync.phase === ShieldedSyncPhase.Recovering
  const balances = useMemo(() => shieldedBalancesByAddress(sync.notes), [sync.notes])

  const {
    requests,
    loading: requestsLoading,
    err: requestsErr,
  } = useReceiveRequests(walletId, 'shielded')
  const claimed = useMemo(() => claimedReceiveAddresses(requests), [requests])

  useEffect(() => {
    setAddresses(null)
    setPassword('')
    setError(null)
    if (!walletId) {
      setChecking(false)
      return
    }
    let dead = false
    setChecking(true)
    API.getShieldedAddresses(walletId)
      .then((cached) => { if (!dead) setAddresses(cached?.length ? cached : null) })
      .catch(() => { /* fall through to unlock form */ })
      .finally(() => { if (!dead) setChecking(false) })
    return () => { dead = true }
  }, [walletId])

  const handlePasswordChange = (value: string): void => {
    setError(null)
    setPassword(value)
  }

  const handleAddAddress = async (): Promise<void> => {
    if (!walletId || password.length === 0 || revealing) return
    setRevealing(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        return
      }
      const nextAddresses = await API.addShieldedAddress(walletId, password)
      setAddresses(nextAddresses)
      setPassword('')
    } catch {
      setError(addressFormCopy.addFailed)
    } finally {
      setRevealing(false)
    }
  }

  if (checking) {
    return <ListSkeleton rows={1} rowClassName="h-[2.5rem] rounded-[.875rem]" />
  }

  if (addresses !== null && !synced) {
    return (
      <>
        <ShieldedNotesAlert walletId={walletId} onSync={() => setSyncOpen(true)} syncing={syncRunning} required />
        <ShieldedUnlockModal
          isOpen={syncOpen}
          onClose={() => setSyncOpen(false)}
          walletId={walletId ?? null}
        />
      </>
    )
  }

  if (addresses !== null) {
    const currentAddress = nextReceiveShieldedAddress(addresses, balances, claimed)

    const handleClear = (): void => {
      setLabel('')
      setAmount('')
      setError(null)
    }

    const handleSave = (): void => {
      if (!walletId || !currentAddress) return
      try {
        addReceiveRequest(
          walletId,
          'shielded',
          currentAddress,
          label,
          receiveAmountDuffs(amount),
        )
        setLabel('')
        setAmount('')
      } catch (err) {
        const message = err instanceof Error ? err.message : RECEIVE_HISTORY_COPY.requestFailed
        setError(message)
        toast.error(RECEIVE_HISTORY_COPY.requestFailed)
      }
    }

    const handleDelete = (request: ReceiveRequestDto): void => {
      if (!walletId) return
      deleteReceiveRequest(walletId, request.id)
      if (selectedRequest?.id === request.id) setSelectedRequest(null)
      toast.success(RECEIVE_HISTORY_COPY.deleteSuccess)
    }

    return (
      <>
        <div className={"flex flex-col gap-6 w-full"}>
          <ShieldedNotesAlert walletId={walletId} onSync={() => setSyncOpen(true)} syncing={syncRunning} />

          {currentAddress ? (
            <ReceiveRequestForm
              address={currentAddress}
              kind={"shielded"}
              label={label}
              amount={amount}
              busy={revealing}
              error={error}
              submitDisabled={!walletId}
              headerExtra={
                <CustomBadge
                  variant={"accent"}
                  text={receiveCardCopy.privateChip}
                  icon={<ShieldSmallIcon size={12} className={"text-dash-brand dark:text-dash-mint"} />}
                />
              }
              onLabelChange={(val) => {
                setError(null)
                setLabel(val)
              }}
              onAmountChange={(val) => {
                setError(null)
                setAmount(val)
              }}
              onClear={handleClear}
              onSubmit={handleSave}
            />
          ) : (
            <div className={`flex max-w-115 flex-col gap-3 ${SURFACE_SECTION}`}>
              <div className={"flex items-center gap-2"}>
                <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
                <Text size={14} weight={"extrabold"} color={"brand"}>New shielded address</Text>
              </div>
              <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
                {receiveCardCopy.shieldedDerivePrompt}
              </Text>
              <PasswordField
                id={"shielded-new-address-password"}
                value={password}
                onChange={handlePasswordChange}
                onSubmit={handleAddAddress}
                error={error}
                disabled={revealing}
                autoFocus={false}
              />
              <Button
                type={"button"}
                onClick={handleAddAddress}
                disabled={password.length === 0 || revealing}
                variant={"solid"}
                colorScheme={"primary"}
                size={"compact"}
                className={"self-start"}
              >
                {revealing ? receiveCardCopy.generating : 'Generate address'}
              </Button>
            </div>
          )}

          <ReceiveRequestsTable
            requests={requests}
            loading={requestsLoading}
            error={requestsErr}
            onSelect={setSelectedRequest}
            onDelete={handleDelete}
            onRetry={walletId ? () => refreshReceiveRequests(walletId) : undefined}
          />
        </div>

        <ReceiveRequestModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
        />

        <ShieldedUnlockModal
          isOpen={syncOpen}
          onClose={() => setSyncOpen(false)}
          walletId={walletId ?? null}
        />
      </>
    )
  }

  const handleReveal = async (): Promise<void> => {
    if (!walletId || password.length === 0 || revealing) return
    setRevealing(true)
    setError(null)
    try {
      const ok = await API.verifyWalletPassword(walletId, password)
      if (!ok) {
        setError(INVALID_WALLET_PASSWORD_MESSAGE)
        return
      }
      setAddresses(await API.getShieldedAddresses(walletId, password))
      setPassword('')
    } catch {
      setError(receiveCardCopy.loadFailed)
    } finally {
      setRevealing(false)
    }
  }

  return (
    <div className={`flex max-w-115 flex-col gap-3 ${SURFACE_SECTION}`}>
      <div className={"flex items-center gap-2"}>
        <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
        <Text size={14} weight={"extrabold"} color={"brand"}>Shielded address</Text>
      </div>
      <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
        {receiveCardCopy.shieldedUnlockPrompt}
      </Text>
      <PasswordField
        id={"shielded-receive-password"}
        value={password}
        onChange={handlePasswordChange}
        onSubmit={handleReveal}
        error={error}
        disabled={revealing}
        autoFocus={false}
      />
      <Button
        type={"button"}
        onClick={handleReveal}
        disabled={!walletId || password.length === 0 || revealing}
        variant={"solid"}
        colorScheme={"primary"}
        size={"compact"}
        className={"self-start"}
      >
        {revealing ? addressFormCopy.loading : receiveCardCopy.showAddress}
      </Button>
    </div>
  )
}
