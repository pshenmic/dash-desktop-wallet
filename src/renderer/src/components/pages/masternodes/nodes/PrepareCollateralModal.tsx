import { useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import type { Outpoint } from '@renderer/api/types'
import {
  Button,
  HighlightedIdentifier,
  InfoCircleIcon,
  Text,
} from '@renderer/components/dash-ui-kit-extended'
import RecipientInput from '@renderer/components/pages/transfer/RecipientInput'
import Alert from '@renderer/components/ui/Alert'
import CheckRow from '@renderer/components/ui/CheckRow'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import FadingScrollArea from '@renderer/components/ui/FadingScrollArea'
import Modal from '@renderer/components/ui/Modal'
import PasswordField from '@renderer/components/ui/PasswordField'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  MASTERNODE_YOUR_ADDRESSES_HEADING,
} from '@renderer/constants/masternodeAddresses'
import {
  MASTERNODE_COLLATERAL_PREP_COPY,
  MASTERNODE_PREP_COLLATERAL_RECIPIENT_COPY,
} from '@renderer/constants/masternodeCollateralPrep'
import { RECEIVE_LABEL_MAX_LENGTH } from '@renderer/constants/receivePage'
import { CHIP_ACTION, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { AlertTone } from '@renderer/enums/AlertTone'
import { ModalSize } from '@renderer/enums/ModalSize'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { refreshAddresses } from '@renderer/hooks/useAdresses'
import { invalidateAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { addReceiveRequest, refreshReceiveRequests } from '@renderer/hooks/useReceiveRequests'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'
import type { PrepareCollateralModalProps } from '@renderer/types/MasternodeCollateralPrep'
import { isValidDashChangeAddress } from '@renderer/utils/address'
import { davToDash } from '@renderer/utils/balance'
import { getErrorMessage } from '@renderer/utils/error'
import { isConfirmingUtxo } from '@renderer/utils/masternodeActions'
import {
  autoSelectCollateralPrepUtxos,
  collateralTargetAddressOptions,
  defaultCollateralLabel,
  fallbackCollateralTargetAddress,
  nextCollateralLabelOnAddressChange,
  pickFreshCollateralTargetAddress,
  prepOutpointKey,
  requiredCollateralDuffs,
  resolveCreatedCollateralOutpoint,
  spendablePrepUtxos,
  summarizeCollateralPrepSelection,
} from '@renderer/utils/masternodeCollateralPrep'
import MasternodeFieldInput from './MasternodeFieldInput'

export default function PrepareCollateralModal({
  open,
  walletId,
  type,
  network,
  utxos,
  receiving,
  claimedAddresses,
  labelsByAddress,
  badgeFor,
  addressesLoading,
  addressesError,
  onRetryAddresses,
  onPrepared,
  onClose,
}: PrepareCollateralModalProps): React.JSX.Element {
  const addressNetwork = network ?? undefined
  const requiredDuffs = requiredCollateralDuffs(type)
  const requiredDashText = `${davToDash(requiredDuffs)} ${DASH_UNIT}`
  const coins = useMemo(() => spendablePrepUtxos(utxos), [utxos])
  const coinByKey = useMemo(() => new Map(coins.map(coin => [prepOutpointKey(coin), coin])), [coins])
  const targetOptions = useMemo(
    () => collateralTargetAddressOptions(receiving, claimedAddresses, labelsByAddress),
    [receiving, claimedAddresses, labelsByAddress],
  )

  const [targetAddress, setTargetAddress] = useState('')
  const [label, setLabel] = useState('')
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [creatingAddress, setCreatingAddress] = useState(false)
  const [feeDuffs, setFeeDuffs] = useState<bigint | null>(null)
  const [feeEstimating, setFeeEstimating] = useState(false)
  const [feeError, setFeeError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)
  const autoDerivedOnOpenRef = useRef(false)

  const deriveFreshTargetAddress = async (): Promise<void> => {
    setCreatingAddress(true)
    try {
      const created = await API.addWalletAddress(walletId, false)
      setTargetAddress(created)
      setLabel(current => nextCollateralLabelOnAddressChange('', created, current, badgeFor, type))
      invalidateAsyncCache('receiveAddress', walletId)
      void refreshAddresses(walletId)
    } catch {
      const fallback = fallbackCollateralTargetAddress(receiving)
      if (fallback !== '') {
        setTargetAddress(fallback)
        setLabel(nextCollateralLabelOnAddressChange('', fallback, '', badgeFor, type))
      }
    } finally {
      setCreatingAddress(false)
    }
  }

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      autoDerivedOnOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return
    wasOpenRef.current = true
    scrollAreaRef.current?.scrollTo({ top: 0 })
    setSelectedKeys(autoSelectCollateralPrepUtxos(coins, requiredDuffs))
    setFeeDuffs(null)
    setFeeError(null)
    setPassword('')
    setPasswordInvalid(false)
    setSubmitError(null)
    setLabel(defaultCollateralLabel(type))

    const freshClean = pickFreshCollateralTargetAddress(receiving, claimedAddresses, labelsByAddress)
    if (freshClean != null) {
      setTargetAddress(freshClean)
      return
    }
    setTargetAddress('')
    if (!addressesLoading && receiving.length > 0 && !autoDerivedOnOpenRef.current) {
      autoDerivedOnOpenRef.current = true
      void deriveFreshTargetAddress()
    }
  }, [open, type, coins, requiredDuffs, receiving, claimedAddresses, labelsByAddress, addressesLoading])

  useEffect(() => {
    if (!open || addressesLoading || targetAddress !== '' || creatingAddress) return
    const freshClean = pickFreshCollateralTargetAddress(receiving, claimedAddresses, labelsByAddress)
    if (freshClean != null) {
      setTargetAddress(freshClean)
      return
    }
    if (!autoDerivedOnOpenRef.current && receiving.length > 0) {
      autoDerivedOnOpenRef.current = true
      void deriveFreshTargetAddress()
    }
  }, [open, addressesLoading, targetAddress, creatingAddress, receiving, claimedAddresses, labelsByAddress])

  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedOutpoints = useMemo<Outpoint[]>(
    () => selectedKeys.flatMap(key => {
      const coin = coinByKey.get(key)
      return coin != null ? [{ txid: coin.txid, vout: coin.vout }] : []
    }),
    [selectedKeys, coinByKey],
  )
  const selectedTotal = useMemo(
    () => selectedKeys.reduce((sum, key) => sum + (coinByKey.get(key)?.satoshis ?? 0n), 0n),
    [selectedKeys, coinByKey],
  )
  const addressValid = isValidDashChangeAddress(targetAddress, addressNetwork)

  useEffect(() => {
    if (!open || !addressValid || selectedOutpoints.length === 0 || selectedTotal < requiredDuffs) {
      setFeeDuffs(null)
      setFeeEstimating(false)
      setFeeError(null)
      return
    }
    let cancelled = false
    setFeeEstimating(true)
    setFeeError(null)
    void API.estimateFee(walletId, TransferOperation.CoreSend, {
      amountCredits: 0n,
      recipient: targetAddress.trim(),
      amountDuffs: requiredDuffs,
      coreSource: { kind: 'outpoints', outpoints: selectedOutpoints },
    })
      .then(quote => {
        if (!cancelled) setFeeDuffs(quote.feeDuffs)
      })
      .catch(err => {
        if (!cancelled) {
          setFeeDuffs(null)
          setFeeError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setFeeEstimating(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, walletId, targetAddress, addressValid, selectedOutpoints, selectedTotal, requiredDuffs])

  const summary = useMemo(
    () => summarizeCollateralPrepSelection(coins, selectedKeySet, requiredDuffs, feeDuffs),
    [coins, selectedKeySet, requiredDuffs, feeDuffs],
  )

  const toggleCoin = (key: string, checked: boolean): void => {
    setSubmitError(null)
    setSelectedKeys(prev => {
      if (checked) return prev.includes(key) ? prev : [...prev, key]
      return prev.filter(item => item !== key)
    })
  }

  const canSubmit = !submitting
    && !creatingAddress
    && !feeEstimating
    && addressValid
    && selectedOutpoints.length > 0
    && summary.enough
    && password.length > 0

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    const trimmedAddress = targetAddress.trim()
    const trimmedLabel = label.trim()
    setSubmitting(true)
    setPasswordInvalid(false)
    setSubmitError(null)
    try {
      const valid = await API.verifyWalletPassword(walletId, password)
      if (!valid) {
        setPasswordInvalid(true)
        setSubmitting(false)
        return
      }
      if (trimmedLabel !== '') {
        await API.setAddressLabel(walletId, trimmedAddress, trimmedLabel)
        if (!claimedAddresses.has(trimmedAddress)) {
          await addReceiveRequest(walletId, trimmedAddress, trimmedLabel, requiredDuffs)
        } else {
          void refreshReceiveRequests(walletId)
        }
      }
      const sent = await API.sendTransaction(
        walletId,
        [{ address: trimmedAddress, amountDuffs: requiredDuffs }],
        password,
        { kind: 'outpoints', outpoints: selectedOutpoints },
      )
      const refreshedUtxos = await API.getUtxos(walletId).catch(() => [])
      const createdOutpoint = resolveCreatedCollateralOutpoint(sent.txid, requiredDuffs, refreshedUtxos)
      invalidateAsyncCache('receiveAddress', walletId)
      void refreshAddresses(walletId)
      void refreshBalance(walletId)
      setPassword('')
      onPrepared(createdOutpoint, refreshedUtxos)
      onClose()
    } catch (err) {
      setSubmitError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={MASTERNODE_COLLATERAL_PREP_COPY.modalTitle}
      description={MASTERNODE_COLLATERAL_PREP_COPY.modalDescription}
      size={ModalSize.Lg}
      dismissible={!submitting}
    >
      <div className={'mt-4 flex flex-col gap-3.5'}>
        <div ref={scrollAreaRef} className={'flex max-h-[calc(85vh-11rem)] flex-col gap-3.5 overflow-y-auto px-0.5 py-0.5 pr-1 scrollbar-custom'}>
          <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
          <div className={'flex flex-col gap-1.5'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {MASTERNODE_COLLATERAL_PREP_COPY.targetAddressSection}
            </Text>

            <RecipientInput
              compact
              hideAddressBook
              hideValueBadge
              value={targetAddress}
              onChange={value => {
                setSubmitError(null)
                setLabel(current => nextCollateralLabelOnAddressChange(targetAddress, value, current, badgeFor, type))
                setTargetAddress(value)
              }}
              data={MASTERNODE_PREP_COLLATERAL_RECIPIENT_COPY}
              ariaLabel={MASTERNODE_PREP_COLLATERAL_RECIPIENT_COPY.label}
              validate={addr => isValidDashChangeAddress(addr, addressNetwork)}
              ownOptions={targetOptions}
              ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
              ownOptionsLoading={addressesLoading}
              ownOptionsError={addressesError}
              onRetryOwnOptions={onRetryAddresses}
            />
          </div>

          <div className={'flex flex-col gap-1.5'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {MASTERNODE_COLLATERAL_PREP_COPY.labelField}
            </Text>
            <MasternodeFieldInput
              value={label}
              onChange={setLabel}
              maxLength={RECEIVE_LABEL_MAX_LENGTH}
              ariaLabel={MASTERNODE_COLLATERAL_PREP_COPY.labelField}
              placeholder={MASTERNODE_COLLATERAL_PREP_COPY.labelPlaceholder}
              disabled={submitting}
            />
          </div>
        </div>

        <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
          <div className={'flex flex-wrap items-center justify-between gap-2'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {MASTERNODE_COLLATERAL_PREP_COPY.coinsSection}
            </Text>
            {coins.length > 0 && (
              <div className={'flex items-center gap-1.5'}>
                <button
                  type={'button'}
                  disabled={submitting}
                  onClick={() => setSelectedKeys(autoSelectCollateralPrepUtxos(coins, requiredDuffs))}
                  className={CHIP_ACTION}
                >
                  {MASTERNODE_COLLATERAL_PREP_COPY.autoSelectButton}
                </button>
                <button
                  type={'button'}
                  disabled={submitting}
                  onClick={() => setSelectedKeys(coins.map(prepOutpointKey))}
                  className={CHIP_ACTION}
                >
                  {MASTERNODE_COLLATERAL_PREP_COPY.selectAllButton}
                </button>
                <button
                  type={'button'}
                  disabled={submitting || selectedKeys.length === 0}
                  onClick={() => setSelectedKeys([])}
                  className={CHIP_ACTION}
                >
                  {MASTERNODE_COLLATERAL_PREP_COPY.clearSelectionButton}
                </button>
              </div>
            )}
          </div>

          {coins.length === 0 ? (
            <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
              {MASTERNODE_COLLATERAL_PREP_COPY.noSpendableCoins}
            </Text>
          ) : (
            <FadingScrollArea enabled className={'max-h-40 overflow-y-auto scrollbar-hide'}>
              <div className={'flex flex-col gap-2 pr-0.5'}>
                {coins.map(coin => {
                  const key = prepOutpointKey(coin)
                  const addrBadge = badgeFor(coin.address)
                  const confirming = isConfirmingUtxo(coin)
                  return (
                    <CheckRow
                      key={key}
                      label={`Select ${coin.address}, ${key}`}
                      checked={selectedKeySet.has(key)}
                      disabled={submitting}
                      onChange={checked => toggleCoin(key, checked)}
                    >
                      <div className={'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5'}>
                        <div className={'flex min-w-0 items-center gap-1.5'}>
                          <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>
                            {coin.address}
                          </HighlightedIdentifier>
                          {addrBadge && <CustomBadge variant={'accent'} size={'xs'} text={addrBadge} className={'shrink-0'} />}
                          {confirming && (
                            <CustomBadge
                              variant={'warning'}
                              size={'xs'}
                              text={MASTERNODE_COLLATERAL_PREP_COPY.confirmingCoinBadge}
                              className={'shrink-0'}
                            />
                          )}
                        </div>
                        <Text reset size={14} weight={'bold'} color={'brand'} className={'whitespace-nowrap text-right tabular-nums'}>
                          {`${davToDash(coin.satoshis)} ${DASH_UNIT}`}
                        </Text>
                        <Text reset size={10} weight={'medium'} color={'brand'} opacity={50} className={'col-span-2 truncate font-mono'}>
                          {key}
                        </Text>
                      </div>
                    </CheckRow>
                  )
                })}
              </div>
            </FadingScrollArea>
          )}
        </div>

        <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
            {MASTERNODE_COLLATERAL_PREP_COPY.summarySection}
          </Text>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
              {MASTERNODE_COLLATERAL_PREP_COPY.collateralOutputLabel}
            </Text>
            <Text size={12} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>
              {requiredDashText}
            </Text>
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
              {MASTERNODE_COLLATERAL_PREP_COPY.selectedInputsLabel}
            </Text>
            <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>
              {`${summary.selectedCount} · ${davToDash(summary.selectedTotal)} ${DASH_UNIT}`}
            </Text>
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
              {MASTERNODE_COLLATERAL_PREP_COPY.networkFeeLabel}
            </Text>
            <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>
              {feeEstimating
                ? MASTERNODE_COLLATERAL_PREP_COPY.estimatingFee
                : summary.feeDuffs != null
                  ? `${davToDash(summary.feeDuffs)} ${DASH_UNIT}`
                  : '—'}
            </Text>
          </div>
          {summary.changeDuffs != null && (
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                {MASTERNODE_COLLATERAL_PREP_COPY.changeReturnedLabel}
              </Text>
              <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                {`${davToDash(summary.changeDuffs)} ${DASH_UNIT}`}
              </Text>
            </div>
          )}
        </div>

        {summary.shortfallDuffs > 0n && (
          <Alert
            tone={AlertTone.Warning}
            icon={<InfoCircleIcon size={16} color={'currentColor'} />}
            title={`${MASTERNODE_COLLATERAL_PREP_COPY.insufficientPrefix} ${davToDash(summary.shortfallDuffs)} ${MASTERNODE_COLLATERAL_PREP_COPY.insufficientSuffix}`}
          />
        )}

        {feeError != null && summary.shortfallDuffs === 0n && (
          <Alert
            tone={AlertTone.Warning}
            icon={<InfoCircleIcon size={16} color={'currentColor'} />}
            title={feeError}
          />
        )}

        {submitError != null && <CopyableError message={submitError} />}

        <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
            {MASTERNODE_COLLATERAL_PREP_COPY.authorizeLabel}
          </Text>
          <PasswordField
            id={'prepare-collateral-password'}
            value={password}
            onChange={value => {
              setPasswordInvalid(false)
              setSubmitError(null)
              setPassword(value)
            }}
            onSubmit={() => { void handleSubmit() }}
            error={passwordInvalid ? INVALID_WALLET_PASSWORD_MESSAGE : null}
            disabled={submitting}
            autoFocus={false}
          />
        </div>
        </div>

        <div className={'flex gap-3 pt-1'}>
          <Button
            type={'button'}
            variant={'outline'}
            colorScheme={'primary-light'}
            size={'md'}
            disabled={submitting}
            onClick={onClose}
            className={'flex-1 rounded-[.9375rem]'}
          >
            {MASTERNODE_COLLATERAL_PREP_COPY.cancelButton}
          </Button>
          <Button
            type={'button'}
            colorScheme={'primary'}
            size={'md'}
            disabled={!canSubmit}
            onClick={() => { void handleSubmit() }}
            className={'flex-1 rounded-[.9375rem]'}
          >
            {submitting
              ? MASTERNODE_COLLATERAL_PREP_COPY.submitting
              : `${MASTERNODE_COLLATERAL_PREP_COPY.submitPrefix} ${requiredDashText} ${MASTERNODE_COLLATERAL_PREP_COPY.submitSuffix}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
