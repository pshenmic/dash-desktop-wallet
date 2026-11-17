import { Fragment, useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { MasternodeRegistrationResult, Network } from '@renderer/api/types'
import { Button, CheckIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import { ProgressStepBar } from '@renderer/components/dash-ui-kit-extended/progressStepBar'
import PageHeader from '@renderer/components/ui/PageHeader'
import Spinner from '@renderer/components/ui/Spinner'
import { DASH_UNIT } from '@renderer/constants/balance'
import { REGISTER_MASTERNODE_COPY } from '@renderer/constants/masternodeNodes'
import { REGISTER_WIZARD_COPY, REGISTER_WIZARD_STEPS } from '@renderer/constants/masternodeRegistration'
import {
  MAINNET_CORE_PORT,
  MAINNET_PLATFORM_HTTP_PORT,
  MAINNET_PLATFORM_P2P_PORT,
  TESTNET_DEFAULT_CORE_PORT,
  TESTNET_DEFAULT_PLATFORM_HTTP_PORT,
  TESTNET_DEFAULT_PLATFORM_P2P_PORT,
} from '@renderer/constants/masternodes'
import { SURFACE_PANEL } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { refreshMasternodes } from '@renderer/hooks/useMasternodes'
import { useWalletAddressOptions } from '@renderer/hooks/useWalletAddressOptions'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'
import { useWalletUtxos } from '@renderer/hooks/useWalletUtxos'
import type {
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
import { recordPendingMasternode } from '@renderer/utils/pendingMasternodes'
import {
  RegisterStepAddresses,
  RegisterStepCollateral,
  RegisterStepNetwork,
  RegisterStepReview,
  RegisterWizardDone,
} from './RegisterWizardSteps'

function createInitialDraft(network: Network | null): RegisterWizardDraft {
  const isTestnet = network === 'testnet'
  return {
    type: 'Regular',
    collateralSource: 'wallet',
    selectedCollateral: '',
    manualTxid: '',
    manualVout: '0',
    feeSourceMode: 'auto',
    feeSourceAddress: '',
    payoutAddress: '',
    ownerMode: 'wallet',
    ownerAddress: '',
    votingMode: 'wallet',
    votingAddress: '',
    operatorMode: 'wallet',
    operatorPublicKey: '',
    operatorRewardPercent: '0',
    operatorPayoutAddress: '',
    serviceMode: 'later',
    serviceIp: '',
    servicePort: String(isTestnet ? TESTNET_DEFAULT_CORE_PORT : MAINNET_CORE_PORT),
    platformNodeId: '',
    platformP2PPort: String(isTestnet ? TESTNET_DEFAULT_PLATFORM_P2P_PORT : MAINNET_PLATFORM_P2P_PORT),
    platformHttpPort: String(isTestnet ? TESTNET_DEFAULT_PLATFORM_HTTP_PORT : MAINNET_PLATFORM_HTTP_PORT),
  }
}

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
    badgeFor,
    loading: addressesLoading,
    err: addressesError,
    retry: retryAddresses,
  } = useWalletAddressOptions(walletId)

  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<RegisterWizardDraft>(() => createInitialDraft(network))
  const [password, setPassword] = useState('')
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [broadcastError, setBroadcastError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<MasternodeRegistrationResult | null>(null)

  const updateDraft = (patch: Partial<RegisterWizardDraft>): void => {
    setDraft(current => ({ ...current, ...patch }))
  }

  const collateralCoins = useMemo(
    () => eligibleCollateralUtxos(utxos, draft.type),
    [utxos, draft.type],
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
    () => validateRegistrationWizard({ ...draft, selectedCollateral: activeCollateral }, collateralCoins, utxos, network),
    [draft, activeCollateral, collateralCoins, utxos, network],
  )

  const stepErrors = [validation.step1Error, validation.step2Error, validation.step3Error, null] as const
  const activeStepError = stepErrors[step]
  const canAdvance = activeStepError == null
  const isLastStep = step === REGISTER_WIZARD_STEPS.length - 1
  const canBroadcast = validation.dto != null && validation.customKeyRoles.length === 0

  const resetWalletKeys = (): void => {
    updateDraft({ ownerMode: 'wallet', votingMode: 'wallet', operatorMode: 'wallet' })
  }

  const handleStepBack = (): void => {
    if (submitting) return
    setBroadcastError(null)
    setPasswordInvalid(false)
    if (step === 0) onBack()
    else setStep(current => current - 1)
  }

  const handleBroadcast = async (): Promise<void> => {
    if (submitting || !canBroadcast || validation.dto == null || password.length === 0) return
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
      const res = await API.registerMasternode(walletId, validation.dto, password)
      setPassword('')
      recordPendingMasternode(walletId, {
        proTxHash: res.proTxHash,
        type: validation.dto.type,
        collateralTxid: validation.dto.collateral.txid,
        collateralVout: validation.dto.collateral.vout,
        collateralAddress: validation.selectedCoin?.address ?? null,
        serviceAddress: validation.dto.serviceAddress,
        payeeAddress: validation.dto.payoutAddress,
        ownerAddress: draft.ownerMode === 'external' ? draft.ownerAddress.trim() : null,
        votingAddress: draft.votingMode === 'external' ? draft.votingAddress.trim() : null,
        operatorPublicKey: draft.operatorMode === 'external' ? draft.operatorPublicKey.trim().toLowerCase() : null,
        platformNodeId: validation.dto.platformNodeId,
        platformP2PPort: validation.dto.platformP2PPort,
        platformHttpPort: validation.dto.platformHttpPort,
        createdAt: Date.now(),
      })
      void refreshMasternodes(walletId)
      void refreshBalance(walletId)
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
    addressOptions,
    badgeFor,
    addressesLoading,
    addressesError,
    onRetryAddresses: retryAddresses,
  }

  return (
    <div className={'flex flex-col'}>
      <PageHeader
        title={REGISTER_WIZARD_COPY.pageTitle}
        subtitle={REGISTER_WIZARD_COPY.pageSubtitle}
        onBack={() => { if (!submitting) onBack() }}
        backLabel={REGISTER_WIZARD_COPY.backLabel}
      />

      <div className={`mx-auto w-full max-w-[48rem] ${SURFACE_PANEL}`}>
        {result != null ? (
          <RegisterWizardDone
            result={result}
            type={draft.type}
            network={network}
            onViewNode={onOpenNode}
            onDone={onBack}
          />
        ) : (
          <div className={'flex flex-col'}>
            <ol className={'flex flex-wrap items-center gap-y-2'}>
              {REGISTER_WIZARD_STEPS.map((meta, index) => {
                const done = index < step
                const active = index === step
                return (
                  <Fragment key={meta.id}>
                    <li className={'flex shrink-0 items-center gap-2'} aria-current={active ? 'step' : undefined}>
                      <button
                        type={'button'}
                        disabled={!done || submitting}
                        onClick={() => { if (done) setStep(index) }}
                        className={`flex items-center gap-2 ${done ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
                      >
                        <span
                          className={`size-8 shrink-0 rounded-full border flex items-center justify-center ${
                            active || done
                              ? 'border-dash-brand dark:border-dash-mint bg-dash-brand/5 dark:bg-dash-mint/5'
                              : 'border-dash-primary-dark-blue/15 dark:border-white/15'
                          }`}
                        >
                          {done
                            ? <CheckIcon size={12} color={'currentColor'} className={'text-dash-brand dark:text-dash-mint [&_circle]:hidden'} />
                            : <Text size={12} weight={'medium'} color={active ? 'blue-mint' : 'brand'} opacity={active ? 100 : 50}>{index + 1}</Text>}
                        </span>
                        <Text
                          size={12}
                          weight={active ? 'extrabold' : 'medium'}
                          color={active || done ? 'blue-mint' : 'brand'}
                          opacity={active || done ? 100 : 50}
                          className={'whitespace-nowrap'}
                        >
                          {meta.label}
                        </Text>
                      </button>
                    </li>
                    {index < REGISTER_WIZARD_STEPS.length - 1 && (
                      <li aria-hidden={'true'} className={'h-px min-w-4 flex-1 mx-2.5 bg-dash-primary-dark-blue/10 dark:bg-white/10'} />
                    )}
                  </Fragment>
                )
              })}
            </ol>

            <ProgressStepBar currentStep={step + 1} totalSteps={REGISTER_WIZARD_STEPS.length} color={'blue-mint'} className={'mt-4 mb-6'} />

            <div className={'phase-fade-in flex flex-col gap-4'} key={step}>
              {step === 0 && (
                <RegisterStepCollateral
                  {...sharedStepProps}
                  collateralOptions={collateralOptions}
                  activeCollateral={activeCollateral}
                  utxosLoading={utxosLoading}
                  utxosError={utxosError}
                  onRetryUtxos={retryUtxos}
                />
              )}
              {step === 1 && (
                <RegisterStepAddresses
                  {...sharedStepProps}
                  onResetWalletKeys={resetWalletKeys}
                />
              )}
              {step === 2 && <RegisterStepNetwork {...sharedStepProps} />}
              {step === 3 && (
                <RegisterStepReview
                  {...sharedStepProps}
                  activeCollateral={activeCollateral}
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
                  onResetWalletKeys={resetWalletKeys}
                  onSubmit={() => { void handleBroadcast() }}
                />
              )}
            </div>

            {activeStepError != null && (
              <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'mt-4 px-1'}>
                {activeStepError}
              </Text>
            )}

            <div className={'mt-6 flex gap-2'}>
              <Button
                type={'button'}
                variant={'outline'}
                colorScheme={'primary-light'}
                size={'md'}
                disabled={submitting}
                onClick={handleStepBack}
                className={'flex-1 rounded-[.9375rem]'}
              >
                {step === 0 ? REGISTER_WIZARD_COPY.cancel : REGISTER_WIZARD_COPY.back}
              </Button>
              {isLastStep ? (
                <Button
                  type={'button'}
                  colorScheme={'lightBlue-mint'}
                  size={'md'}
                  disabled={!canBroadcast || password.length === 0 || submitting}
                  onClick={() => { void handleBroadcast() }}
                  className={'flex-1 gap-2 rounded-[.9375rem]'}
                >
                  {submitting && <Spinner size={16} className={'text-current'} />}
                  {submitting ? REGISTER_WIZARD_COPY.submitting : REGISTER_WIZARD_COPY.submit}
                </Button>
              ) : (
                <Button
                  type={'button'}
                  colorScheme={'lightBlue-mint'}
                  size={'md'}
                  disabled={!canAdvance}
                  onClick={() => setStep(current => current + 1)}
                  className={'flex-1 rounded-[.9375rem]'}
                >
                  {REGISTER_WIZARD_COPY.continue}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
