import { useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import type { Outpoint } from '@renderer/api/types'
import {
  Button,
  HighlightedIdentifier,
  InfoCircleIcon,
  InfoTooltip,
  Text,
} from '@renderer/components/dash-ui-kit-extended'
import Alert from '@renderer/components/ui/Alert'
import CheckRow from '@renderer/components/ui/CheckRow'
import CopyButton from '@renderer/components/ui/CopyButton'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import FadingScrollArea from '@renderer/components/ui/FadingScrollArea'
import PasswordField from '@renderer/components/ui/PasswordField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { ADDRESS_ROW_IDENTIFIER_CLASS } from '@renderer/constants/addressRow'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  COLLATERAL_PREP_COIN_MODE_OPTIONS,
  MASTERNODE_COLLATERAL_PREP_COPY,
} from '@renderer/constants/masternodeCollateralPrep'
import { REGISTER_MASTERNODE_COPY } from '@renderer/constants/masternodeNodes'
import { REGISTER_WIZARD_COPY } from '@renderer/constants/masternodeRegistration'
import { RECEIVE_LABEL_MAX_LENGTH } from '@renderer/constants/receivePage'
import { CHIP_ACTION, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { AlertTone } from '@renderer/enums/AlertTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { TransferOperation } from '@renderer/enums/TransferOperation'
import { refreshAddresses } from '@renderer/hooks/useAdresses'
import { invalidateAsyncCache } from '@renderer/hooks/useAsyncWithCache'
import { addReceiveRequest, deleteReceiveRequest } from '@renderer/hooks/useReceiveRequests'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'
import type {
  CollateralPrepCoinMode,
  PrepareCollateralSectionProps,
} from '@renderer/types/MasternodeCollateralPrep'
import { isValidDashChangeAddress } from '@renderer/utils/address'
import { davToDash } from '@renderer/utils/balance'
import { getErrorMessage } from '@renderer/utils/error'
import { isConfirmingUtxo } from '@renderer/utils/masternodeActions'
import {
  autoSelectCollateralPrepUtxos,
  defaultCollateralLabel,
  fallbackCollateralTargetAddress,
  isExactCollateralCoin,
  isSufficientPrepCoin,
  nextCollateralLabelOnAddressChange,
  pickFreshCollateralTargetAddress,
  planCollateralInvoiceSync,
  prepOutpointKey,
  requiredCollateralDuffs,
  resolveCollateralPrepSelectedKeys,
  resolveCreatedCollateralOutpoint,
  spendablePrepUtxos,
  summarizeCollateralPrepSelection,
  unifiedCollateralStepCoins,
} from '@renderer/utils/masternodeCollateralPrep'
import MasternodeFieldInput from './MasternodeFieldInput'

export default function PrepareCollateralSection({
  walletId,
  type,
  network,
  utxos,
  receiving,
  requests,
  claimedAddresses,
  labelsByAddress,
  badgeFor,
  addressesLoading,
  addressesError,
  onRetryAddresses,
  activeExactOutpoint,
  preparedOutpoint,
  utxosLoading,
  utxosError,
  onRetryUtxos,
  onSelectExactOutpoint,
  onStartCombineMode,
  onPrepared,
}: PrepareCollateralSectionProps): React.JSX.Element {
  const addressNetwork = network ?? undefined
  const requiredDuffs = requiredCollateralDuffs(type)
  const requiredDashText = `${davToDash(requiredDuffs)} ${DASH_UNIT}`
  const allCoins = useMemo(() => unifiedCollateralStepCoins(utxos, requiredDuffs), [utxos, requiredDuffs])
  const coins = useMemo(() => spendablePrepUtxos(utxos), [utxos])
  const coinByKey = useMemo(() => new Map(coins.map(coin => [prepOutpointKey(coin), coin])), [coins])
  const activeExactCoin = useMemo(
    () => (activeExactOutpoint == null
      ? null
      : allCoins.find(coin => prepOutpointKey(coin) === activeExactOutpoint) ?? null),
    [allCoins, activeExactOutpoint],
  )
  const hasCombineCandidates = useMemo(
    () => coins.some(coin => !isExactCollateralCoin(coin, requiredDuffs)),
    [coins, requiredDuffs],
  )

  const [targetAddress, setTargetAddress] = useState('')
  const [label, setLabel] = useState(() => defaultCollateralLabel(type))
  const [coinMode, setCoinMode] = useState<CollateralPrepCoinMode>('auto')
  const [manualKeys, setManualKeys] = useState<string[]>([])
  const [creatingAddress, setCreatingAddress] = useState(false)
  const [deriveAddressError, setDeriveAddressError] = useState<string | null>(null)
  const [feeDuffs, setFeeDuffs] = useState<bigint | null>(null)
  const [feeEstimating, setFeeEstimating] = useState(false)
  const [feeError, setFeeError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const autoDerivedRef = useRef(false)
  const prevTypeRef = useRef(type)

  useEffect(() => {
    if (prevTypeRef.current === type) return
    const prevDefault = defaultCollateralLabel(prevTypeRef.current)
    prevTypeRef.current = type
    setLabel(current => (current.trim() === '' || current === prevDefault ? defaultCollateralLabel(type) : current))
    setSubmitError(null)
  }, [type])

  const deriveFreshTargetAddress = async (): Promise<void> => {
    setCreatingAddress(true)
    setDeriveAddressError(null)
    try {
      const created = await API.addWalletAddress(walletId, false)
      setTargetAddress(created)
      setLabel(current => nextCollateralLabelOnAddressChange('', created, current, badgeFor, type))
      invalidateAsyncCache('receiveAddress', walletId)
      void refreshAddresses(walletId)
    } catch (err) {
      const fallback = fallbackCollateralTargetAddress(receiving)
      if (fallback !== '') {
        setTargetAddress(fallback)
        setLabel(nextCollateralLabelOnAddressChange('', fallback, '', badgeFor, type))
      } else {
        setDeriveAddressError(getErrorMessage(err))
      }
    } finally {
      setCreatingAddress(false)
    }
  }

  useEffect(() => {
    if (activeExactOutpoint != null || addressesLoading || targetAddress !== '' || creatingAddress) return
    const freshClean = pickFreshCollateralTargetAddress(receiving, claimedAddresses, labelsByAddress)
    if (freshClean != null) {
      setDeriveAddressError(null)
      setTargetAddress(freshClean)
      return
    }
    if (!autoDerivedRef.current && addressesError == null) {
      autoDerivedRef.current = true
      void deriveFreshTargetAddress()
    }
  }, [
    activeExactOutpoint,
    addressesLoading,
    addressesError,
    targetAddress,
    creatingAddress,
    receiving,
    claimedAddresses,
    labelsByAddress,
  ])

  const selectedKeys = useMemo(
    () => resolveCollateralPrepSelectedKeys(coinMode, coins, requiredDuffs, manualKeys),
    [coinMode, coins, requiredDuffs, manualKeys],
  )
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
    if (activeExactOutpoint != null || !addressValid || selectedOutpoints.length === 0 || selectedTotal < requiredDuffs) {
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
  }, [activeExactOutpoint, walletId, targetAddress, addressValid, selectedOutpoints, selectedTotal, requiredDuffs])

  const summary = useMemo(
    () => summarizeCollateralPrepSelection(coins, selectedKeySet, requiredDuffs, feeDuffs),
    [coins, selectedKeySet, requiredDuffs, feeDuffs],
  )

  const handleCoinModeChange = (nextMode: CollateralPrepCoinMode): void => {
    setSubmitError(null)
    if (nextMode === 'manual' && coinMode === 'auto') {
      setManualKeys(autoSelectCollateralPrepUtxos(coins, requiredDuffs))
    }
    setCoinMode(nextMode)
  }

  const toggleManualCoin = (key: string, checked: boolean): void => {
    if (coinMode !== 'manual') return
    setSubmitError(null)
    setManualKeys(prev => {
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
      const invoiceSync = planCollateralInvoiceSync(trimmedAddress, trimmedLabel, requiredDuffs, requests)
      if (invoiceSync.deleteRequestId != null) {
        await deleteReceiveRequest(walletId, invoiceSync.deleteRequestId)
      }
      if (invoiceSync.createRequest != null) {
        await addReceiveRequest(
          walletId,
          trimmedAddress,
          invoiceSync.createRequest.label,
          invoiceSync.createRequest.amountDuffs,
        )
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
      setTargetAddress('')
      setDeriveAddressError(null)
      autoDerivedRef.current = false
      setLabel(defaultCollateralLabel(type))
      onPrepared(createdOutpoint, refreshedUtxos)
    } catch (err) {
      setSubmitError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const addressFailure = addressesError ?? deriveAddressError

  return (
    <div className={'flex flex-col gap-3'}>
      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>
              {MASTERNODE_COLLATERAL_PREP_COPY.coinsSection}
            </Text>
            <InfoTooltip
              content={MASTERNODE_COLLATERAL_PREP_COPY.coinsTooltip}
              ariaLabel={MASTERNODE_COLLATERAL_PREP_COPY.coinsSection}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
          {activeExactOutpoint == null && (
            <div className={'flex flex-wrap items-center gap-2'}>
              {coinMode === 'manual' && coins.length > 0 && (
                <div className={'flex items-center gap-1.5'}>
                  <button
                    type={'button'}
                    disabled={submitting}
                    onClick={() => setManualKeys(coins.map(prepOutpointKey))}
                    className={CHIP_ACTION}
                  >
                    {MASTERNODE_COLLATERAL_PREP_COPY.selectAllButton}
                  </button>
                  <button
                    type={'button'}
                    disabled={submitting || selectedKeys.length === 0}
                    onClick={() => setManualKeys([])}
                    className={CHIP_ACTION}
                  >
                    {MASTERNODE_COLLATERAL_PREP_COPY.clearSelectionButton}
                  </button>
                </div>
              )}
              <SegmentedControl
                appearance={SegmentedControlAppearance.Pill}
                ariaLabel={MASTERNODE_COLLATERAL_PREP_COPY.coinModeAriaLabel}
                options={COLLATERAL_PREP_COIN_MODE_OPTIONS}
                value={coinMode}
                onChange={handleCoinModeChange}
              />
            </div>
          )}
        </div>

        {utxosLoading && allCoins.length === 0 ? (
          <ListSkeleton rows={2} rowClassName={'h-14 rounded-[.875rem]'} />
        ) : utxosError != null && allCoins.length === 0 ? (
          <Alert
            tone={AlertTone.Warning}
            icon={<InfoCircleIcon size={14} />}
            title={utxosError}
            actions={(
              <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={onRetryUtxos}>
                {REGISTER_WIZARD_COPY.retryButton}
              </Button>
            )}
          />
        ) : allCoins.length === 0 ? (
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
            {MASTERNODE_COLLATERAL_PREP_COPY.noSpendableCoins}
          </Text>
        ) : (
          <>
            {utxosError != null && (
              <Alert
                tone={AlertTone.Warning}
                icon={<InfoCircleIcon size={14} />}
                title={utxosError}
                actions={(
                  <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={onRetryUtxos}>
                    {REGISTER_WIZARD_COPY.retryButton}
                  </Button>
                )}
              />
            )}
            <FadingScrollArea enabled className={'max-h-48 overflow-y-auto scrollbar-hide'}>
              <div className={'flex flex-col gap-2 pr-0.5'}>
                {allCoins.map(coin => {
                  const key = prepOutpointKey(coin)
                  const addrBadge = badgeFor(coin.address)
                  const confirming = isConfirmingUtxo(coin)
                  const exact = isExactCollateralCoin(coin, requiredDuffs)
                  const sufficient = !exact && isSufficientPrepCoin(coin, requiredDuffs)
                  const isSuccessTone = exact || sufficient
                  const checked = activeExactOutpoint != null
                    ? key === activeExactOutpoint
                    : selectedKeySet.has(key)
                  const disabled = activeExactOutpoint != null
                    ? submitting
                    : submitting || (coinMode === 'auto' && !exact)

                  return (
                    <CheckRow
                      key={key}
                      label={`Select ${coin.address}, ${key}`}
                      checked={checked}
                      disabled={disabled}
                      dimChildren={false}
                      tone={isSuccessTone ? 'success' : 'default'}
                      onChange={nextChecked => {
                        setSubmitError(null)
                        if (activeExactOutpoint != null) {
                          if (exact) {
                            onSelectExactOutpoint(key)
                          } else {
                            onStartCombineMode()
                            setCoinMode('manual')
                            setManualKeys([key])
                          }
                          return
                        }
                        if (exact) {
                          onSelectExactOutpoint(key)
                          return
                        }
                        if (coinMode === 'auto') {
                          setCoinMode('manual')
                          setManualKeys([key])
                          return
                        }
                        toggleManualCoin(key, nextChecked)
                      }}
                    >
                      <div className={'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5'}>
                        <div className={'flex min-w-0 flex-wrap items-center gap-1.5'}>
                          <HighlightedIdentifier className={ADDRESS_ROW_IDENTIFIER_CLASS}>
                            {coin.address}
                          </HighlightedIdentifier>
                          {addrBadge && <CustomBadge variant={'accent'} size={'xs'} text={addrBadge} className={'shrink-0'} />}
                          {isSuccessTone && (
                            <span className={'inline-flex shrink-0 items-center rounded-full bg-dash-green-15 px-2 py-0.5 text-[10px] font-semibold text-dash-green'}>
                              {exact ? MASTERNODE_COLLATERAL_PREP_COPY.exactCollateralBadge : MASTERNODE_COLLATERAL_PREP_COPY.sufficientCoinBadge}
                            </span>
                          )}
                          {confirming && (
                            <CustomBadge
                              variant={'warning'}
                              size={'xs'}
                              text={MASTERNODE_COLLATERAL_PREP_COPY.confirmingCoinBadge}
                              className={'shrink-0'}
                            />
                          )}
                        </div>
                        <Text
                          reset
                          size={14}
                          weight={'bold'}
                          color={'brand'}
                          className={`whitespace-nowrap text-right tabular-nums ${isSuccessTone ? 'text-dash-green!' : ''}`}
                        >
                          {`${davToDash(coin.satoshis)} ${DASH_UNIT}`}
                        </Text>
                        <HighlightedIdentifier className={'col-span-2 min-w-0 font-mono! text-[0.625rem]! leading-[1.1rem]! break-all opacity-65'}>
                          {key}
                        </HighlightedIdentifier>
                      </div>
                    </CheckRow>
                  )
                })}
              </div>
            </FadingScrollArea>
          </>
        )}
      </div>

      {activeExactOutpoint != null ? (
        <>
          <Alert
            tone={AlertTone.Success}
            icon={<InfoCircleIcon size={14} />}
            title={preparedOutpoint === activeExactOutpoint
              ? MASTERNODE_COLLATERAL_PREP_COPY.preparedTitle
              : MASTERNODE_COLLATERAL_PREP_COPY.exactSelectedReadyTitle}
            description={preparedOutpoint === activeExactOutpoint
              ? MASTERNODE_COLLATERAL_PREP_COPY.preparedDescription
              : MASTERNODE_COLLATERAL_PREP_COPY.exactSelectedReadyDescription}
          />
          {activeExactCoin != null && isConfirmingUtxo(activeExactCoin) && (
            <Alert
              tone={AlertTone.Warning}
              icon={<InfoCircleIcon size={14} />}
              title={REGISTER_MASTERNODE_COPY.confirmingCollateralTitle}
              description={REGISTER_MASTERNODE_COPY.confirmingCollateralDescription}
            />
          )}
          {hasCombineCandidates && (
            <div className={'flex items-center justify-start'}>
              <button
                type={'button'}
                disabled={submitting}
                onClick={() => {
                  setSubmitError(null)
                  onStartCombineMode()
                }}
                className={CHIP_ACTION}
              >
                {MASTERNODE_COLLATERAL_PREP_COPY.combineOtherCoinsButton}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
            <div className={'flex flex-col gap-1.5'}>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'bold'} color={'brand'}>
                  {MASTERNODE_COLLATERAL_PREP_COPY.targetAddressSection}
                </Text>
                <InfoTooltip
                  content={MASTERNODE_COLLATERAL_PREP_COPY.targetAddressTooltip}
                  ariaLabel={MASTERNODE_COLLATERAL_PREP_COPY.targetAddressSection}
                  className={'size-4 [&_svg]:size-3.5'}
                />
              </div>
              {(addressesLoading || creatingAddress) && targetAddress === '' ? (
                <ListSkeleton rows={1} rowClassName={'h-[3.25rem] rounded-2xl'} />
              ) : addressFailure != null && targetAddress === '' ? (
                <Alert
                  tone={AlertTone.Warning}
                  icon={<InfoCircleIcon size={14} />}
                  title={addressFailure}
                  actions={(
                    <Button
                      type={'button'}
                      size={'compact'}
                      colorScheme={'primary-light'}
                      onClick={() => {
                        setDeriveAddressError(null)
                        autoDerivedRef.current = false
                        onRetryAddresses()
                      }}
                    >
                      {REGISTER_WIZARD_COPY.retryButton}
                    </Button>
                  )}
                />
              ) : targetAddress === '' ? (
                <ListSkeleton rows={1} rowClassName={'h-[3.25rem] rounded-2xl'} />
              ) : (
                <div className={'min-h-[3.25rem] flex items-center justify-between gap-2 rounded-2xl dash-block px-4 py-2.5'}>
                  <HighlightedIdentifier className={'min-w-0 flex-1 font-mono! text-xs! break-all'}>
                    {targetAddress}
                  </HighlightedIdentifier>
                  <CopyButton text={targetAddress} className={'shrink-0'} />
                </div>
              )}
            </div>

            <div className={'flex flex-col gap-1.5'}>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'bold'} color={'brand'}>
                  {MASTERNODE_COLLATERAL_PREP_COPY.labelField}
                </Text>
                <InfoTooltip
                  content={MASTERNODE_COLLATERAL_PREP_COPY.labelTooltip}
                  ariaLabel={MASTERNODE_COLLATERAL_PREP_COPY.labelField}
                  className={'size-4 [&_svg]:size-3.5'}
                />
              </div>
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

          <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
            <div className={'flex items-center gap-1.5'}>
              <Text size={12} weight={'bold'} color={'brand'}>
                {MASTERNODE_COLLATERAL_PREP_COPY.summarySection}
              </Text>
              <InfoTooltip
                content={MASTERNODE_COLLATERAL_PREP_COPY.summaryTooltip}
                ariaLabel={MASTERNODE_COLLATERAL_PREP_COPY.summarySection}
                className={'size-4 [&_svg]:size-3.5'}
              />
            </div>
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
            <div className={'flex items-center gap-1.5'}>
              <label htmlFor={'prepare-collateral-password'}>
                <Text size={12} weight={'bold'} color={'brand'}>
                  {MASTERNODE_COLLATERAL_PREP_COPY.authorizeLabel}
                </Text>
              </label>
              <InfoTooltip
                content={MASTERNODE_COLLATERAL_PREP_COPY.authorizeTooltip}
                ariaLabel={MASTERNODE_COLLATERAL_PREP_COPY.authorizeLabel}
                className={'size-4 [&_svg]:size-3.5'}
              />
            </div>
            <PasswordField
              id={'prepare-collateral-password'}
              hideLabel
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
            <Button
              type={'button'}
              colorScheme={'primary'}
              size={'md'}
              disabled={!canSubmit}
              onClick={() => { void handleSubmit() }}
              className={'mt-1 w-full rounded-[.9375rem]'}
            >
              {submitting
                ? MASTERNODE_COLLATERAL_PREP_COPY.submitting
                : MASTERNODE_COLLATERAL_PREP_COPY.submitButton}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
