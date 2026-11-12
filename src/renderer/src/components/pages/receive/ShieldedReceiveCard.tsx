import { useEffect, useMemo, useState } from 'react'
import { Button, Text, ShieldSmallIcon } from '@renderer/components/dash-ui-kit-extended'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import PasswordField from '@renderer/components/ui/PasswordField'
import ShieldedUnlockModal from '@renderer/components/modal/ShieldedUnlockModal'
import ShieldedNotesAlert from '@renderer/components/ui/ShieldedNotesAlert'
import ReceiveAddressPanel from './ReceiveAddressPanel'
import { defaultReceiveShieldedAddress, receiveShieldedAddresses } from '@renderer/utils/receiveDefaults'
import { shieldedBalancesByAddress } from '@renderer/utils/shieldedBalances'
import { API } from '@renderer/api'
import { addressFormCopy, INVALID_WALLET_PASSWORD_MESSAGE, receiveCardCopy } from '@renderer/constants'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { RECEIVE_INVOICE_ADDRESS_LABELS, RECEIVE_WIDE_PANEL_CLASS } from '@renderer/constants/receiveInvoice'
import { useShieldedSyncState } from '@renderer/hooks/useShielded'
import { ShieldedSyncPhase } from '@renderer/enums/ShieldedSyncPhase'

export default function ShieldedReceiveCard({ walletId }: { walletId: string | undefined }): React.JSX.Element {
  const [addresses, setAddresses] = useState<string[] | null>(null)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)

  const sync = useShieldedSyncState(walletId)
  const synced = sync.phase === ShieldedSyncPhase.Done
  const syncRunning = sync.phase === ShieldedSyncPhase.Syncing || sync.phase === ShieldedSyncPhase.Recovering
  const balances = useMemo(() => shieldedBalancesByAddress(sync.notes), [sync.notes])

  useEffect(() => {
    setAddresses(null)
    setSelectedAddress(null)
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
      setSelectedAddress(defaultReceiveShieldedAddress(nextAddresses, balances) ?? null)
      setPassword('')
    } catch {
      setError(addressFormCopy.addFailed)
    } finally {
      setRevealing(false)
    }
  }

  const handlePasswordChange = (value: string): void => {
    setError(null)
    setPassword(value)
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
    const receiveAddresses = receiveShieldedAddresses(addresses, balances)
    const selected = (selectedAddress && receiveAddresses.includes(selectedAddress) ? selectedAddress : null) ?? receiveAddresses[0]
    if (!selected) {
      return (
        <div className={`flex max-w-115 flex-col gap-3 ${SURFACE_SECTION}`}>
          <div className={"flex items-center gap-2"}>
            <ShieldSmallIcon size={16} className={"text-dash-brand dark:text-dash-mint"} />
            <Text size={14} weight={"extrabold"} color={"brand"}>New shielded address</Text>
          </div>
          <Text size={12} weight={"medium"} color={"brand"} opacity={50} className={"leading-[130%]"}>
            {receiveCardCopy.allShieldedFunded}
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
      )
    }

    return (
      <>
        <div className={`flex w-full flex-col gap-4 ${RECEIVE_WIDE_PANEL_CLASS}`}>
          <ShieldedNotesAlert walletId={walletId} onSync={() => setSyncOpen(true)} syncing={syncRunning} />
          <ReceiveAddressPanel
            address={selected}
            wideAddress
            addressLabel={RECEIVE_INVOICE_ADDRESS_LABELS.shielded}
            addressBadge={
              <CustomBadge
                variant={"accent"}
                text={receiveCardCopy.privateChip}
                icon={<ShieldSmallIcon size={12} className={"text-dash-brand dark:text-dash-mint"} />}
              />
            }
          />
        </div>

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
