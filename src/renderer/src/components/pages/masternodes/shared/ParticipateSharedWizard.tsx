import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { API } from '@renderer/api'
import type {
  SharedRegistrationConsentResultDto,
  SharedRegistrationFundingPreviewDto,
  SharedRegistrationFundingResultDto,
} from '@renderer/api/types'
import {
  Button,
  HighlightedIdentifier,
  InfoCircleIcon,
  KeyIcon,
  SuccessIcon,
  Text,
} from '@renderer/components/dash-ui-kit-extended'
import Alert from '@renderer/components/ui/Alert'
import CopyButton from '@renderer/components/ui/CopyButton'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import HashField from '@renderer/components/ui/HashField'
import PageHeader from '@renderer/components/ui/PageHeader'
import PasswordField from '@renderer/components/ui/PasswordField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ShareBar from '@renderer/components/ui/ShareBar'
import Spinner from '@renderer/components/ui/Spinner'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { FIELD_INVALID } from '@renderer/constants/addressField'
import { DASH_UNIT } from '@renderer/constants/balance'
import { SHARED_STAGE_OPTIONS, SHARED_WIZARD_COPY } from '@renderer/constants/sharedRegistration'
import { CHIP_ACTION, FIELD_COMPACT, SURFACE_PANEL, SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { AlertTone } from '@renderer/enums/AlertTone'
import { SharedRegistrationStage } from '@renderer/enums/Masternodes'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import type { ParticipateSharedWizardProps } from '@renderer/types/SharedRegistration'
import { davToDash } from '@renderer/utils/balance'
import { getErrorMessage } from '@renderer/utils/error'
import { formatSharePercent, shareRatio } from '@renderer/utils/masternodeNodes'
import {
  canSignSharedStage,
  formatConsentSignaturesForCopy,
  isPlausibleTxHex,
  normalizeSharedTxHex,
} from '@renderer/utils/sharedRegistration'
import ManageMasternodeKeysModal from '../nodes/ManageMasternodeKeysModal'

export default function ParticipateSharedWizard({
  walletId,
  onBack,
}: ParticipateSharedWizardProps): React.JSX.Element {
  const inputId = useId()
  const passwordId = useId()
  const [stage, setStage] = useState<SharedRegistrationStage>(SharedRegistrationStage.Consent)
  const [txHex, setTxHex] = useState('')
  const [preview, setPreview] = useState<SharedRegistrationFundingPreviewDto | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewNonce, setPreviewNonce] = useState(0)
  const [password, setPassword] = useState('')
  const [passwordInvalid, setPasswordInvalid] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [consentResult, setConsentResult] = useState<SharedRegistrationConsentResultDto | null>(null)
  const [fundingResult, setFundingResult] = useState<SharedRegistrationFundingResultDto | null>(null)
  const [keysOpen, setKeysOpen] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const requestIdRef = useRef(0)

  const normalizedHex = useMemo(() => normalizeSharedTxHex(txHex), [txHex])
  const plausibleHex = useMemo(() => isPlausibleTxHex(normalizedHex), [normalizedHex])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    if (consentResult != null || fundingResult != null || normalizedHex === '') {
      setPreview(null)
      setPreviewLoading(false)
      setPreviewError(null)
      return
    }
    if (!plausibleHex) {
      setPreview(null)
      setPreviewLoading(false)
      setPreviewError(SHARED_WIZARD_COPY.invalidTxHexHint)
      return
    }

    setPreviewLoading(true)
    setPreviewError(null)
    void API.previewSharedMasternodeRegistration(walletId, normalizedHex)
      .then((res) => {
        if (requestId !== requestIdRef.current) return
        setPreview(res)
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return
        setPreview(null)
        setPreviewError(getErrorMessage(err))
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setPreviewLoading(false)
      })
  }, [walletId, normalizedHex, plausibleHex, previewNonce, consentResult, fundingResult])

  const eligibility = useMemo(() => canSignSharedStage(preview, stage), [preview, stage])
  const signableShareSet = useMemo(() => new Set(preview?.signableShares ?? []), [preview])

  const resetAll = (): void => {
    if (signing) return
    setTxHex('')
    setPreview(null)
    setPreviewError(null)
    setPassword('')
    setPasswordInvalid(false)
    setSignError(null)
    setConsentResult(null)
    setFundingResult(null)
    setCopiedAll(false)
  }

  const handleStageChange = (next: SharedRegistrationStage): void => {
    if (signing) return
    setStage(next)
    setSignError(null)
    setPasswordInvalid(false)
  }

  const canSubmit = !signing
    && !previewLoading
    && preview != null
    && eligibility.canSign
    && password.length > 0

  const handleSign = async (): Promise<void> => {
    if (!canSubmit || !plausibleHex) return
    setSigning(true)
    setPasswordInvalid(false)
    setSignError(null)
    try {
      const valid = await API.verifyWalletPassword(walletId, password)
      if (!valid) {
        setPasswordInvalid(true)
        return
      }
      if (stage === SharedRegistrationStage.Consent) {
        const res = await API.signSharedMasternodeRegistrationConsent(walletId, normalizedHex, password)
        setPassword('')
        setConsentResult(res)
      } else {
        const res = await API.signSharedMasternodeRegistrationFunding(walletId, normalizedHex, password)
        setPassword('')
        setFundingResult(res)
      }
    } catch (err) {
      setSignError(getErrorMessage(err))
    } finally {
      setSigning(false)
    }
  }

  const handleCopyAllConsent = (): void => {
    if (consentResult == null) return
    void navigator.clipboard.writeText(formatConsentSignaturesForCopy(consentResult.signatures))
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 1500)
  }

  const proceedToFunding = (): void => {
    setConsentResult(null)
    setFundingResult(null)
    setTxHex('')
    setPreview(null)
    setPreviewError(null)
    setPassword('')
    setPasswordInvalid(false)
    setSignError(null)
    setStage(SharedRegistrationStage.Funding)
  }

  const showReset = txHex.trim() !== '' || consentResult != null || fundingResult != null

  return (
    <div className={'flex flex-col'}>
      <PageHeader
        title={SHARED_WIZARD_COPY.pageTitle}
        subtitle={SHARED_WIZARD_COPY.pageSubtitle}
        onBack={() => { if (!signing) onBack() }}
        backLabel={SHARED_WIZARD_COPY.backLabel}
        actions={showReset ? (
          <button
            type={'button'}
            disabled={signing}
            onClick={resetAll}
            className={CHIP_ACTION}
          >
            {SHARED_WIZARD_COPY.resetButton}
          </button>
        ) : undefined}
      />

      {consentResult != null ? (
        <div className={`mx-auto flex w-full max-w-170 flex-col gap-5 ${SURFACE_PANEL}`}>
          <div className={'flex flex-col items-center gap-2 py-2 text-center'}>
            <SuccessIcon size={44} />
            <Text size={18} weight={'extrabold'} color={'brand'}>{SHARED_WIZARD_COPY.consentDoneHeadline}</Text>
            <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'max-w-md leading-[140%]'}>
              {SHARED_WIZARD_COPY.consentDoneDescription}
            </Text>
          </div>

          <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
            <div className={'flex items-center justify-between gap-3'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{SHARED_WIZARD_COPY.consentHashLabel}</Text>
              <div className={'flex min-w-0 items-center gap-2'}>
                <HighlightedIdentifier className={'min-w-0 text-xs!'}>{consentResult.preview.consentHash}</HighlightedIdentifier>
                <CopyButton text={consentResult.preview.consentHash} className={'shrink-0'} />
              </div>
            </div>
            {consentResult.signatures.length > 1 && (
              <div className={'flex justify-end pt-1'}>
                <button type={'button'} onClick={handleCopyAllConsent} className={CHIP_ACTION}>
                  {copiedAll ? SHARED_WIZARD_COPY.copiedAllSignatures : SHARED_WIZARD_COPY.copyAllSignatures}
                </button>
              </div>
            )}
            <div className={'flex flex-col gap-2'}>
              {consentResult.signatures.map(entry => (
                <HashField
                  key={entry.shareIndex}
                  label={`${SHARED_WIZARD_COPY.shareSignatureLabelPrefix}${entry.shareIndex + 1}`}
                  hash={entry.signature}
                />
              ))}
            </div>
          </div>

          <div className={'flex flex-wrap gap-3'}>
            <Button
              type={'button'}
              variant={'outline'}
              colorScheme={'primary-light'}
              size={'md'}
              onClick={onBack}
              className={'flex-1 rounded-[.9375rem]'}
            >
              {SHARED_WIZARD_COPY.backToShared}
            </Button>
            <Button
              type={'button'}
              colorScheme={'primary'}
              size={'md'}
              onClick={proceedToFunding}
              className={'flex-1 rounded-[.9375rem]'}
            >
              {SHARED_WIZARD_COPY.proceedToFunding}
            </Button>
          </div>
        </div>
      ) : fundingResult != null ? (
        <div className={`mx-auto flex w-full max-w-170 flex-col gap-5 ${SURFACE_PANEL}`}>
          <div className={'flex flex-col items-center gap-2 py-2 text-center'}>
            <SuccessIcon size={44} />
            <Text size={18} weight={'extrabold'} color={'brand'}>{SHARED_WIZARD_COPY.fundingDoneHeadline}</Text>
            <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'max-w-md leading-[140%]'}>
              {SHARED_WIZARD_COPY.fundingDoneDescription}
            </Text>
          </div>

          <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{SHARED_WIZARD_COPY.signedInputsLabel}</Text>
              <Text size={12} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>
                {fundingResult.signedInputs.map(idx => `#${idx}`).join(', ')}
              </Text>
            </div>
            <HashField
              label={SHARED_WIZARD_COPY.signedHexLabel}
              hash={fundingResult.signedHex}
            />
          </div>

          <div className={'flex'}>
            <Button
              type={'button'}
              colorScheme={'primary'}
              size={'md'}
              onClick={onBack}
              className={'flex-1 rounded-[.9375rem]'}
            >
              {SHARED_WIZARD_COPY.backToShared}
            </Button>
          </div>
        </div>
      ) : (
        <div className={`mx-auto flex w-full max-w-170 flex-col gap-4 ${SURFACE_PANEL}`}>
          <div className={'flex flex-wrap items-center justify-between gap-3'}>
            <Text size={12} weight={'bold'} color={'brand'}>{SHARED_WIZARD_COPY.stageLabel}</Text>
            <SegmentedControl
              appearance={SegmentedControlAppearance.Pill}
              ariaLabel={SHARED_WIZARD_COPY.stageLabel}
              options={SHARED_STAGE_OPTIONS}
              value={stage}
              onChange={handleStageChange}
              disabled={signing}
            />
          </div>

          <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
            <label htmlFor={inputId}>
              <Text size={12} weight={'bold'} color={'brand'}>{SHARED_WIZARD_COPY.txHexLabel}</Text>
            </label>
            <div className={`flex w-full flex-col items-stretch py-3 ${FIELD_COMPACT} ${previewError != null ? FIELD_INVALID : ''}`}>
              <textarea
                id={inputId}
                rows={4}
                value={txHex}
                onChange={(event) => {
                  setSignError(null)
                  setTxHex(event.target.value)
                }}
                placeholder={SHARED_WIZARD_COPY.txHexPlaceholder}
                autoComplete={'off'}
                autoCorrect={'off'}
                autoCapitalize={'off'}
                spellCheck={false}
                disabled={signing}
                className={'min-h-[5.5rem] w-full resize-y bg-transparent p-0 font-mono text-xs leading-relaxed outline-none dash-text-default placeholder:font-sans placeholder:text-sm placeholder:text-current placeholder:opacity-40'}
              />
            </div>
            <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'leading-[135%]'}>
              {SHARED_WIZARD_COPY.stageHints[stage]}
            </Text>
          </div>

          {previewLoading && (
            <div className={'flex items-center gap-2.5 px-1'} role={'status'}>
              <Spinner size={16} className={'dash-text-primary'} />
              <Text size={12} weight={'medium'} color={'brand'} opacity={70}>{SHARED_WIZARD_COPY.previewLoading}</Text>
            </div>
          )}

          {!previewLoading && previewError != null && <CopyableError message={previewError} />}

          {!previewLoading && preview != null && (
            <>
              {preview.warning != null && (
                <Alert
                  tone={AlertTone.Warning}
                  icon={<InfoCircleIcon size={16} color={'currentColor'} />}
                  title={preview.warning}
                />
              )}

              <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
                <Text size={12} weight={'bold'} color={'brand'}>{SHARED_WIZARD_COPY.summarySection}</Text>
                <div className={'flex items-center justify-between gap-4'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{SHARED_WIZARD_COPY.consentHashLabel}</Text>
                  <div className={'flex min-w-0 items-center gap-2'}>
                    <HighlightedIdentifier className={'min-w-0 text-xs!'}>{preview.consentHash}</HighlightedIdentifier>
                    <CopyButton text={preview.consentHash} className={'shrink-0'} />
                  </div>
                </div>
                <div className={'flex items-center justify-between gap-4'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{SHARED_WIZARD_COPY.collateralLabel}</Text>
                  <Text size={12} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>
                    {`${davToDash(preview.collateralDuffs)} ${DASH_UNIT}`}
                  </Text>
                </div>
                <div className={'flex items-center justify-between gap-4'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{SHARED_WIZARD_COPY.signableSharesLabel}</Text>
                  <Text size={12} weight={'bold'} color={'brand'} className={'tabular-nums'}>
                    {`${preview.signableShares.length} / ${preview.shares.length}`}
                  </Text>
                </div>
                <div className={'flex items-center justify-between gap-4'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{SHARED_WIZARD_COPY.walletFundingLabel}</Text>
                  <Text size={12} weight={'bold'} color={'brand'} className={'tabular-nums'}>
                    {`${preview.fundingInputs.length} · ${davToDash(preview.fundingTotalDuffs)} ${DASH_UNIT}`}
                  </Text>
                </div>
                <div className={'flex items-center justify-between gap-4'}>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{SHARED_WIZARD_COPY.otherInputsLabel}</Text>
                  <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{String(preview.unresolvedInputs)}</Text>
                </div>
              </div>

              <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
                <Text size={12} weight={'bold'} color={'brand'}>{SHARED_WIZARD_COPY.sharesSection}</Text>
                <div className={'flex flex-col gap-1.5'}>
                  {preview.shares.map((share) => {
                    const owned = signableShareSet.has(share.index)
                    const ratio = shareRatio(share.amountDuffs, preview.collateralDuffs)
                    return (
                      <div key={share.index} className={`flex flex-col gap-2 ${SURFACE_ROW}`}>
                        <div className={'flex min-w-0 flex-wrap items-center justify-between gap-2'}>
                          <div className={'flex min-w-0 flex-1 items-center gap-2'}>
                            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0 tabular-nums'}>
                              {`#${share.index + 1}`}
                            </Text>
                            <CustomBadge
                              variant={owned ? 'accent' : 'muted'}
                              text={owned ? SHARED_WIZARD_COPY.yourShareBadge : SHARED_WIZARD_COPY.participantBadge}
                              className={'shrink-0'}
                            />
                            <HighlightedIdentifier className={'min-w-0 text-xs! font-medium!'}>{share.ownerAddress}</HighlightedIdentifier>
                          </div>
                          <div className={'flex shrink-0 items-baseline gap-2'}>
                            <Text size={14} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>
                              {`${davToDash(share.amountDuffs)} ${DASH_UNIT}`}
                            </Text>
                            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>
                              {formatSharePercent(ratio)}
                            </Text>
                          </div>
                        </div>
                        {(share.rewardAddress != null || share.refundAddress != null) && (
                          <div className={'flex flex-col gap-0.5 text-[0.6875rem]'}>
                            {share.rewardAddress != null && (
                              <div className={'flex min-w-0 items-center gap-1.5'}>
                                <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0'}>
                                  {SHARED_WIZARD_COPY.rewardAddressPrefix}
                                </Text>
                                <HighlightedIdentifier className={'min-w-0 text-[0.625rem]!'}>{share.rewardAddress}</HighlightedIdentifier>
                              </div>
                            )}
                            {share.refundAddress != null && (
                              <div className={'flex min-w-0 items-center gap-1.5'}>
                                <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0'}>
                                  {SHARED_WIZARD_COPY.refundAddressPrefix}
                                </Text>
                                <HighlightedIdentifier className={'min-w-0 text-[0.625rem]!'}>{share.refundAddress}</HighlightedIdentifier>
                              </div>
                            )}
                          </div>
                        )}
                        <ShareBar share={ratio} />
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
                <Text size={12} weight={'bold'} color={'brand'}>{SHARED_WIZARD_COPY.fundingInputsSection}</Text>
                {preview.fundingInputs.length === 0 ? (
                  <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                    {SHARED_WIZARD_COPY.noWalletFundingInputs}
                  </Text>
                ) : (
                  <div className={'flex flex-col gap-1.5'}>
                    {preview.fundingInputs.map(input => (
                      <div key={input.index} className={`flex items-center justify-between gap-3 ${SURFACE_ROW}`}>
                        <div className={'flex min-w-0 items-center gap-2'}>
                          <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'shrink-0 tabular-nums'}>
                            {`#${input.index}`}
                          </Text>
                          <HighlightedIdentifier className={'min-w-0 text-xs! font-medium!'}>{input.address}</HighlightedIdentifier>
                        </div>
                        <Text size={12} weight={'extrabold'} color={'brand'} className={'shrink-0 tabular-nums'}>
                          {`${davToDash(input.amountDuffs)} ${DASH_UNIT}`}
                        </Text>
                      </div>
                    ))}
                  </div>
                )}

                <Text size={12} weight={'bold'} color={'brand'} className={'pt-2'}>
                  {SHARED_WIZARD_COPY.outputsSection}
                </Text>
                <div className={'flex flex-col gap-1.5'}>
                  {preview.outputs.map((output, idx) => (
                    <div key={`${idx}:${output.address ?? 'collateral'}`} className={`flex items-center justify-between gap-3 ${SURFACE_ROW}`}>
                      <div className={'flex min-w-0 items-center gap-2'}>
                        {output.collateral && (
                          <CustomBadge variant={'accent'} text={SHARED_WIZARD_COPY.collateralOutputBadge} className={'shrink-0'} />
                        )}
                        {output.address != null ? (
                          <HighlightedIdentifier className={'min-w-0 text-xs! font-medium!'}>{output.address}</HighlightedIdentifier>
                        ) : (
                          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                            {output.collateral ? SHARED_WIZARD_COPY.collateralOutputBadge : SHARED_WIZARD_COPY.changeOutputFallback}
                          </Text>
                        )}
                      </div>
                      <Text size={12} weight={'bold'} color={'brand'} className={'shrink-0 tabular-nums'}>
                        {`${davToDash(output.amountDuffs)} ${DASH_UNIT}`}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>

              {!eligibility.canSign && eligibility.reason != null && (
                <Alert
                  tone={AlertTone.Info}
                  icon={<InfoCircleIcon size={16} color={'currentColor'} />}
                  title={eligibility.reason}
                  actions={(
                    <Button
                      type={'button'}
                      size={'compact'}
                      colorScheme={'primary-light'}
                      onClick={() => setKeysOpen(true)}
                      className={'inline-flex items-center gap-1.5'}
                    >
                      <KeyIcon size={12} color={'currentColor'} />
                      {SHARED_WIZARD_COPY.importKeysAction}
                    </Button>
                  )}
                />
              )}

              {eligibility.canSign && (
                <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
                  <label htmlFor={passwordId}>
                    <Text size={12} weight={'bold'} color={'brand'}>{SHARED_WIZARD_COPY.authorizeLabel}</Text>
                  </label>
                  <PasswordField
                    id={passwordId}
                    hideLabel
                    value={password}
                    onChange={(value) => {
                      setPasswordInvalid(false)
                      setSignError(null)
                      setPassword(value)
                    }}
                    onSubmit={() => { void handleSign() }}
                    error={passwordInvalid ? INVALID_WALLET_PASSWORD_MESSAGE : null}
                    disabled={signing}
                    autoFocus={false}
                  />
                  {signError != null && <CopyableError message={signError} />}
                </div>
              )}
            </>
          )}

          <div className={'flex gap-3 pt-1'}>
            <Button
              type={'button'}
              variant={'outline'}
              colorScheme={'primary-light'}
              size={'md'}
              disabled={signing}
              onClick={onBack}
              className={'flex-1 rounded-[.9375rem]'}
            >
              {SHARED_WIZARD_COPY.cancelButton}
            </Button>
            <Button
              type={'button'}
              colorScheme={'primary'}
              size={'md'}
              disabled={!canSubmit}
              onClick={() => { void handleSign() }}
              className={'flex-1 rounded-[.9375rem]'}
            >
              {signing
                ? (stage === SharedRegistrationStage.Consent ? SHARED_WIZARD_COPY.signingConsent : SHARED_WIZARD_COPY.signingFunding)
                : (stage === SharedRegistrationStage.Consent ? SHARED_WIZARD_COPY.signConsentButton : SHARED_WIZARD_COPY.signFundingButton)}
            </Button>
          </div>
        </div>
      )}

      {keysOpen && (
        <ManageMasternodeKeysModal
          walletId={walletId}
          open={keysOpen}
          onClose={() => {
            setKeysOpen(false)
            setPreviewNonce(n => n + 1)
          }}
        />
      )}
    </div>
  )
}
