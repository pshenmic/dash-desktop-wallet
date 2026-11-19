import { useEffect, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import type {
  MasternodeRegistrationPreviewDto,
  MasternodeRegistrationResult,
  SelectableUtxo,
} from '@renderer/api/types'
import { Text } from '@renderer/components/dash-ui-kit-extended'
import TransferWizard from '@renderer/components/pages/transfer/TransferWizard'
import PageHeader from '@renderer/components/ui/PageHeader'
import { DASH_UNIT } from '@renderer/constants/balance'
import { REGISTER_MASTERNODE_COPY } from '@renderer/constants/masternodeNodes'
import { REGISTER_WIZARD_COPY, REGISTER_WIZARD_STEPS } from '@renderer/constants/masternodeRegistration'
import { CHIP_ACTION, SURFACE_PANEL } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { refreshMasternodes } from '@renderer/hooks/useMasternodes'
import { useWalletAddressOptions } from '@renderer/hooks/useWalletAddressOptions'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'
import { useWalletUtxos } from '@renderer/hooks/useWalletUtxos'
import type {
  PersistedRegisterWizardState,
  RegisterWizardDraft,
  RegisterWizardProps,
} from '@renderer/types/MasternodeRegistrationWizard'
import { davToDash } from '@renderer/utils/balance'
import { getErrorMessage } from '@renderer/utils/error'
import {
  eligibleCollateralUtxos,
  isConfirmingUtxo,
  validateRegistrationWizard,
} from '@renderer/utils/masternodeActions'
import {
  clearRegisterWizardDraft,
  getOrCreateRegisterWizardState,
  hasCustomRegisterWizardDraft,
  resetRegisterWizardDraft,
  saveRegisterWizardState,
} from '@renderer/utils/masternodeRegistrationDraft'
import { recordPendingMasternode } from '@renderer/utils/pendingMasternodes'
import { spendablePrepTotal } from '@renderer/utils/masternodeCollateralPrep'
import { buildCustomFeeProRegPreview, fundedFeeAddressOptions } from '@renderer/utils/proRegCustomFee'
import PrepareCollateralModal from './PrepareCollateralModal'
import {
  RegisterStepAddresses,
  RegisterStepCollateral,
  RegisterStepNetwork,
  RegisterStepReview,
  RegisterWizardDone,
} from './RegisterWizardSteps'

export default function RegisterMasternodeWizard({
  walletId,
  onBack,
  onOpenNode,
}: RegisterWizardProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const { utxos, loading: utxosLoading, error: utxosError, retry: retryUtxos } = useWalletUtxos()
  const {
    options: addressOptions,
    receiving,
    change,
    requests,
    claimedAddresses,
    labelsByAddress,
    defaultPayoutAddress,
    badgeFor,
    loading: addressesLoading,
    err: addressesError,
    retry: retryAddresses,
  } = useWalletAddressOptions(walletId)

  const [wizardState, setWizardState] = useState<PersistedRegisterWizardState>(
    () => getOrCreateRegisterWizardState(walletId, network),
  )
  const wizardStateRef = useRef(wizardState)
  wizardStateRef.current = wizardState
  const { step, draft } = wizardState
  const [password, setPassword] = useState('')
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [broadcastError, setBroadcastError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<MasternodeRegistrationResult | null>(null)
  const [preview, setPreview] = useState<MasternodeRegistrationPreviewDto | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewNonce, setPreviewNonce] = useState(0)
  const [coreFeeMultiplier, setCoreFeeMultiplier] = useState(1)
  const [prepareModalOpen, setPrepareModalOpen] = useState(false)
  const [preparedOutpoint, setPreparedOutpoint] = useState<string | null>(null)
  const [prepUtxoSnapshot, setPrepUtxoSnapshot] = useState<SelectableUtxo[] | null>(null)

  useEffect(() => {
    setPrepUtxoSnapshot(null)
  }, [utxos])

  const effectiveUtxos = prepUtxoSnapshot ?? utxos
  const spendablePrepTotalDuffs = useMemo(() => spendablePrepTotal(effectiveUtxos), [effectiveUtxos])

  const updateWizardState = (
    updater: (current: PersistedRegisterWizardState) => PersistedRegisterWizardState,
  ): void => {
    const next = updater(wizardStateRef.current)
    wizardStateRef.current = next
    setWizardState(next)
    saveRegisterWizardState(walletId, next)
  }

  const updateDraft = (patch: Partial<RegisterWizardDraft>): void => {
    updateWizardState(current => ({
      ...current,
      active: true,
      draft: { ...current.draft, ...patch },
    }))
  }

  const collateralCoins = useMemo(
    () => eligibleCollateralUtxos(effectiveUtxos, draft.type),
    [effectiveUtxos, draft.type],
  )
  const collateralOptions = useMemo(
    () => collateralCoins.map(coin => {
      const addrLabel = badgeFor(coin.address)
      const confirming = isConfirmingUtxo(coin)
      return {
        value: `${coin.txid}:${coin.vout}`,
        label: `${coin.txid.slice(0, 12)}…:${coin.vout}`,
        ...(confirming
          ? { badge: REGISTER_MASTERNODE_COPY.confirmingBadge }
          : addrLabel
            ? { badge: addrLabel }
            : {}),
        description: addrLabel && confirming ? `${addrLabel} · ${coin.address}` : coin.address,
        metadata: [
          `${davToDash(coin.satoshis)} ${DASH_UNIT}`,
          confirming
            ? REGISTER_MASTERNODE_COPY.confirmingBadge
            : `${REGISTER_MASTERNODE_COPY.confirmedBlockPrefix}${coin.height.toLocaleString('en-US')}`,
        ],
      }
    }),
    [collateralCoins, badgeFor],
  )

  const activeCollateral = collateralOptions.some(opt => opt.value === draft.selectedCollateral)
    ? draft.selectedCollateral
    : (collateralOptions[0]?.value ?? '')

  const validation = useMemo(
    () => validateRegistrationWizard({ ...draft, selectedCollateral: activeCollateral }, collateralCoins, effectiveUtxos, network, defaultPayoutAddress),
    [draft, activeCollateral, collateralCoins, effectiveUtxos, network, defaultPayoutAddress],
  )

  const stepErrors = [validation.step1Error, validation.step2Error, validation.step3Error, null] as const
  const activeStepError = stepErrors[step]
  const registrationDto = validation.dto
  const fundedFeeOptions = useMemo(
    () => fundedFeeAddressOptions(receiving, change, labelsByAddress, effectiveUtxos, registrationDto?.collateral ?? null),
    [receiving, change, labelsByAddress, effectiveUtxos, registrationDto],
  )
  const customFeeResult = useMemo(() => {
    if (draft.feeSourceMode !== 'address' || preview == null || registrationDto == null) {
      return { preview, error: null }
    }
    return buildCustomFeeProRegPreview({
      basePreview: preview,
      feeAddress: draft.feeSourceAddress,
      utxos: effectiveUtxos,
      collateral: registrationDto.collateral,
      coreFeeMultiplier,
      network,
    })
  }, [draft.feeSourceMode, draft.feeSourceAddress, preview, registrationDto, effectiveUtxos, coreFeeMultiplier, network])
  const effectivePreview = draft.feeSourceMode === 'address' ? customFeeResult.preview : preview
  const customFeeError = draft.feeSourceMode === 'address' ? customFeeResult.error : null
  const canBroadcast = registrationDto != null && effectivePreview != null && customFeeError == null && !previewLoading && previewError == null

  useEffect(() => {
    if (step !== 3 || registrationDto == null || result != null) {
      setPreview(null)
      setPreviewLoading(false)
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    void Promise.all([
      API.previewMasternodeRegistration(walletId, registrationDto),
      API.getPreferences().then(prefs => prefs.general.coreFeeMultiplier).catch(() => 1),
    ])
      .then(([res, multiplier]) => {
        if (!cancelled) {
          setCoreFeeMultiplier(multiplier)
          setPreview(res)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setPreview(null)
          setPreviewError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [walletId, step, registrationDto, effectiveUtxos, result, previewNonce])

  const handleStepSelect = (nextStep: number): void => {
    if (submitting) return
    setBroadcastError(null)
    setPasswordInvalid(false)
    updateWizardState(current => ({ ...current, active: true, step: nextStep }))
  }

  const handleResetForm = (): void => {
    if (submitting) return
    setPassword('')
    setPasswordInvalid(false)
    setBroadcastError(null)
    setPreparedOutpoint(null)
    const fresh = resetRegisterWizardDraft(walletId, network, true)
    wizardStateRef.current = fresh
    setWizardState(fresh)
  }

  const handleBroadcast = async (): Promise<void> => {
    if (submitting || !canBroadcast || registrationDto == null || effectivePreview == null || password.length === 0) return
    setSubmitting(true)
    setPasswordInvalid(false)
    setBroadcastError(null)
    try {
      const valid = await API.verifyWalletPassword(walletId, password)
      if (!valid) {
        setPasswordInvalid(true)
        setSubmitting(false)
        return
      }
      const res = await API.signAndBroadcastMasternodeRegistration(walletId, effectivePreview.unsignedHex, password)
      setPassword('')
      recordPendingMasternode(walletId, {
        proTxHash: res.proTxHash,
        type: registrationDto.type,
        collateralTxid: registrationDto.collateral.txid,
        collateralVout: registrationDto.collateral.vout,
        collateralAddress: validation.selectedCoin?.address ?? null,
        serviceAddress: registrationDto.serviceAddress,
        payeeAddress: registrationDto.payoutAddress,
        ownerAddress: effectivePreview.ownerAddress,
        votingAddress: effectivePreview.votingAddress,
        operatorPublicKey: effectivePreview.operatorPublicKey,
        platformNodeId: registrationDto.platformNodeId,
        platformP2PPort: registrationDto.platformP2PPort,
        platformHttpPort: registrationDto.platformHttpPort,
        createdAt: Date.now(),
      })
      void refreshMasternodes(walletId)
      void refreshBalance(walletId)
      clearRegisterWizardDraft(walletId)
      setResult(res)
    } catch (err) {
      setBroadcastError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const sharedStepProps = {
    draft,
    updateDraft,
    validation,
    network,
    defaultPayoutAddress,
    addressOptions,
    badgeFor,
    addressesLoading,
    addressesError,
    onRetryAddresses: retryAddresses,
  }

  const wizardSteps = [
    {
      label: REGISTER_WIZARD_STEPS[0].label,
      canAdvance: validation.step1Error == null,
      content: (
        <RegisterStepCollateral
          {...sharedStepProps}
          collateralOptions={collateralOptions}
          activeCollateral={activeCollateral}
          utxosLoading={utxosLoading}
          utxosError={utxosError}
          spendablePrepTotalDuffs={spendablePrepTotalDuffs}
          preparedOutpoint={preparedOutpoint}
          onOpenPrepareModal={() => setPrepareModalOpen(true)}
          onRetryUtxos={retryUtxos}
        />
      ),
    },
    {
      label: REGISTER_WIZARD_STEPS[1].label,
      canAdvance: validation.step2Error == null,
      content: <RegisterStepAddresses {...sharedStepProps} />,
    },
    {
      label: REGISTER_WIZARD_STEPS[2].label,
      canAdvance: validation.step3Error == null,
      content: <RegisterStepNetwork {...sharedStepProps} />,
    },
    {
      label: REGISTER_WIZARD_STEPS[3].label,
      content: (
        <RegisterStepReview
          {...sharedStepProps}
          activeCollateral={activeCollateral}
          preview={effectivePreview}
          previewLoading={previewLoading}
          previewError={previewError}
          customFeeError={customFeeError}
          fundedFeeOptions={fundedFeeOptions}
          onRetryPreview={() => setPreviewNonce(n => n + 1)}
          password={password}
          onPasswordChange={value => {
            setPasswordInvalid(false)
            setBroadcastError(null)
            setPassword(value)
          }}
          passwordInvalid={passwordInvalid}
          broadcastError={broadcastError}
          busy={submitting}
          canBroadcast={canBroadcast}
          onSubmit={() => { void handleBroadcast() }}
        />
      ),
    },
  ]

  const showResetAction = result == null && hasCustomRegisterWizardDraft(wizardState, network)

  return (
    <div className={'flex flex-col'}>
      <PageHeader
        title={REGISTER_WIZARD_COPY.pageTitle}
        subtitle={REGISTER_WIZARD_COPY.pageSubtitle}
        onBack={() => { if (!submitting) onBack() }}
        backLabel={REGISTER_WIZARD_COPY.backLabel}
        actions={showResetAction ? (
          <button
            type={'button'}
            disabled={submitting}
            onClick={handleResetForm}
            className={CHIP_ACTION}
          >
            {REGISTER_WIZARD_COPY.resetForm}
          </button>
        ) : undefined}
      />

      {result != null ? (
        <div className={`mx-auto w-full max-w-170 ${SURFACE_PANEL}`}>
          <RegisterWizardDone
            result={result}
            type={draft.type}
            network={network}
            onViewNode={onOpenNode}
            onDone={onBack}
          />
        </div>
      ) : (
        <TransferWizard
          steps={wizardSteps}
          currentStep={step}
          onStepChange={handleStepSelect}
          allowStepClick
          footerNotice={activeStepError != null ? (
            <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'mt-4 px-1'}>
              {activeStepError}
            </Text>
          ) : undefined}
          submitLabel={submitting ? REGISTER_WIZARD_COPY.submitting : REGISTER_WIZARD_COPY.submit}
          submitDisabled={!canBroadcast || password.length === 0 || submitting}
          submitBusy={submitting}
          onSubmit={() => { void handleBroadcast() }}
        />
      )}

      <PrepareCollateralModal
        open={prepareModalOpen}
        walletId={walletId}
        type={draft.type}
        network={network}
        utxos={effectiveUtxos}
        receiving={receiving}
        requests={requests}
        claimedAddresses={claimedAddresses}
        labelsByAddress={labelsByAddress}
        badgeFor={badgeFor}
        addressesLoading={addressesLoading}
        addressesError={addressesError}
        onRetryAddresses={retryAddresses}
        onPrepared={(outpoint, refreshedUtxos) => {
          if (refreshedUtxos.length > 0) setPrepUtxoSnapshot(refreshedUtxos)
          setPreparedOutpoint(outpoint)
          updateDraft({ collateralSource: 'wallet', selectedCollateral: outpoint })
          retryUtxos()
          retryAddresses()
        }}
        onClose={() => setPrepareModalOpen(false)}
      />
    </div>
  )
}
