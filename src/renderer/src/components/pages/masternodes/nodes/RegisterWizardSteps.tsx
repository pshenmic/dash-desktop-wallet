import {
  Button,
  HighlightedIdentifier,
  InfoCircleIcon,
  SuccessIcon,
  Text,
} from '@renderer/components/dash-ui-kit-extended'
import RecipientInput from '@renderer/components/pages/transfer/RecipientInput'
import Alert from '@renderer/components/ui/Alert'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import DropdownField from '@renderer/components/ui/DropdownField'
import HashField from '@renderer/components/ui/HashField'
import PasswordField from '@renderer/components/ui/PasswordField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { ADDRESS_INPUT, ADDRESS_INPUT_TEXT_SIZES } from '@renderer/constants/addressField'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  MASTERNODE_FEE_SOURCE_RECIPIENT_COPY,
  MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY,
  MASTERNODE_OWNER_RECIPIENT_COPY,
  MASTERNODE_PAYOUT_RECIPIENT_COPY,
  MASTERNODE_VOTING_RECIPIENT_COPY,
  MASTERNODE_YOUR_ADDRESSES_HEADING,
} from '@renderer/constants/masternodeAddresses'
import { REGISTER_MASTERNODE_COPY } from '@renderer/constants/masternodeNodes'
import {
  MASTERNODE_TYPE_CARDS,
  OPERATOR_REWARD_PRESETS,
  REGISTER_WIZARD_COLLATERAL_SOURCE_OPTIONS,
  REGISTER_WIZARD_COPY,
  REGISTER_WIZARD_FEE_SOURCE_OPTIONS,
  REGISTER_WIZARD_OPERATOR_MODE_OPTIONS,
  REGISTER_WIZARD_OWNER_MODE_OPTIONS,
  REGISTER_WIZARD_SERVICE_MODE_OPTIONS,
  REGISTER_WIZARD_VOTING_MODE_OPTIONS,
} from '@renderer/constants/masternodeRegistration'
import {
  EVO_MASTERNODE_TYPE,
  UNASSIGNED_SERVICE_ADDRESS,
} from '@renderer/constants/masternodes'
import { CHIP_ACTION, FIELD_COMPACT, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { AlertTone } from '@renderer/enums/AlertTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import type {
  RegisterStepAddressesProps,
  RegisterStepCollateralProps,
  RegisterStepReviewProps,
  RegisterStepSharedProps,
  RegisterWizardDoneProps,
} from '@renderer/types/MasternodeRegistrationWizard'
import { isValidDashChangeAddress } from '@renderer/utils/address'
import { davToDash } from '@renderer/utils/balance'
import { transactionUrl } from '@renderer/utils/explorer'
import {
  isConfirmingUtxo,
  parseOperatorRewardBps,
  splitIpPortInput,
} from '@renderer/utils/masternodeActions'

export function RegisterStepCollateral({
  draft,
  updateDraft,
  validation,
  network,
  addressOptions,
  badgeFor,
  addressesLoading,
  addressesError,
  onRetryAddresses,
  collateralOptions,
  activeCollateral,
  utxosLoading,
  utxosError,
  onRetryUtxos,
}: RegisterStepCollateralProps): React.JSX.Element {
  const addressNetwork = network ?? undefined
  const confirming = validation.selectedCoin != null && isConfirmingUtxo(validation.selectedCoin)

  return (
    <div className={'flex flex-col gap-4'}>
      <div className={'flex flex-col gap-2'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.typeLabel}</Text>
        <div className={'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
          {MASTERNODE_TYPE_CARDS.map(card => {
            const active = draft.type === card.type
            return (
              <button
                key={card.type}
                type={'button'}
                onClick={() => updateDraft({ type: card.type })}
                className={`flex flex-col items-start gap-1.5 rounded-[.9375rem] border p-4 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-dash-brand dark:border-dash-mint dash-block-accent-5'
                    : 'border-dash-primary-dark-blue/10 dark:border-white/10 dash-block-5 hover:dash-block-10'
                }`}
              >
                <div className={'flex w-full items-center justify-between gap-2'}>
                  <Text size={14} weight={'extrabold'} color={active ? 'blue-mint' : 'brand'}>{card.title}</Text>
                  <CustomBadge variant={active ? 'accent' : 'muted'} text={card.amount} />
                </div>
                <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'leading-[135%]'}>
                  {card.summary}
                </Text>
              </button>
            )
          })}
        </div>
      </div>

      <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.collateralLabel}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={REGISTER_WIZARD_COPY.collateralSourceLabel}
            options={REGISTER_WIZARD_COLLATERAL_SOURCE_OPTIONS}
            value={draft.collateralSource}
            onChange={collateralSource => updateDraft({ collateralSource })}
          />
        </div>

        {draft.collateralSource === 'wallet' ? (
          utxosLoading ? (
            <ListSkeleton rows={1} rowClassName={'h-11 rounded-[.875rem]'} />
          ) : utxosError != null ? (
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
          ) : collateralOptions.length === 0 ? (
            <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
              {REGISTER_MASTERNODE_COPY.noCollateralUtxos}
            </Text>
          ) : (
            <DropdownField
              options={collateralOptions}
              value={activeCollateral}
              onChange={selectedCollateral => updateDraft({ selectedCollateral })}
              ariaLabel={REGISTER_MASTERNODE_COPY.collateralLabel}
              triggerClassName={FIELD_COMPACT}
            />
          )
        ) : (
          <div className={'grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end gap-3'}>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.manualTxidLabel}</Text>
              <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
                <input
                  type={'text'}
                  aria-label={REGISTER_WIZARD_COPY.manualTxidLabel}
                  value={draft.manualTxid}
                  onChange={e => updateDraft({ manualTxid: e.target.value })}
                  placeholder={REGISTER_WIZARD_COPY.manualTxidPlaceholder}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
                />
              </div>
            </div>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.manualVoutLabel}</Text>
              <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
                <input
                  type={'text'}
                  aria-label={REGISTER_WIZARD_COPY.manualVoutLabel}
                  value={draft.manualVout}
                  onChange={e => updateDraft({ manualVout: e.target.value })}
                  placeholder={REGISTER_WIZARD_COPY.manualVoutPlaceholder}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]} tabular-nums`}
                />
              </div>
            </div>
          </div>
        )}

        {confirming && (
          <Alert
            tone={AlertTone.Warning}
            icon={<InfoCircleIcon size={14} />}
            title={REGISTER_MASTERNODE_COPY.confirmingCollateralTitle}
            description={REGISTER_MASTERNODE_COPY.confirmingCollateralDescription}
          />
        )}

        {draft.collateralSource === 'manual' && validation.manualOutpointMissingFromWallet && (
          <Alert
            tone={AlertTone.Info}
            icon={<InfoCircleIcon size={14} />}
            title={REGISTER_WIZARD_COPY.manualOutpointMissingTitle}
            description={REGISTER_WIZARD_COPY.manualOutpointMissingDescription}
          />
        )}
      </div>

      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.feeSourceLabel}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={REGISTER_WIZARD_COPY.feeSourceLabel}
            options={REGISTER_WIZARD_FEE_SOURCE_OPTIONS}
            value={draft.feeSourceMode}
            onChange={feeSourceMode => updateDraft({ feeSourceMode })}
          />
        </div>
        {draft.feeSourceMode === 'auto' ? (
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
            {REGISTER_WIZARD_COPY.feeSourceAutoNote}
          </Text>
        ) : (
          <>
            <RecipientInput
              compact
              value={draft.feeSourceAddress}
              valueBadge={badgeFor(draft.feeSourceAddress)}
              onChange={feeSourceAddress => updateDraft({ feeSourceAddress })}
              data={MASTERNODE_FEE_SOURCE_RECIPIENT_COPY}
              ariaLabel={REGISTER_WIZARD_COPY.feeSourceLabel}
              validate={addr => isValidDashChangeAddress(addr, addressNetwork)}
              ownOptions={addressOptions}
              ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
              ownOptionsLoading={addressesLoading}
              ownOptionsError={addressesError}
              onRetryOwnOptions={onRetryAddresses}
            />
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {REGISTER_WIZARD_COPY.feeSourceCustomNote}
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export function RegisterStepAddresses({
  draft,
  updateDraft,
  validation,
  network,
  addressOptions,
  badgeFor,
  addressesLoading,
  addressesError,
  onRetryAddresses,
  onResetWalletKeys,
}: RegisterStepAddressesProps): React.JSX.Element {
  const addressNetwork = network ?? undefined
  const rewardBps = parseOperatorRewardBps(draft.operatorRewardPercent)

  return (
    <div className={'flex flex-col gap-3'}>
      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.payoutLabel}</Text>
        <RecipientInput
          compact
          value={draft.payoutAddress}
          valueBadge={badgeFor(draft.payoutAddress)}
          onChange={payoutAddress => updateDraft({ payoutAddress })}
          data={MASTERNODE_PAYOUT_RECIPIENT_COPY}
          ariaLabel={REGISTER_MASTERNODE_COPY.payoutLabel}
          ownOptions={addressOptions}
          ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
          ownOptionsLoading={addressesLoading}
          ownOptionsError={addressesError}
          onRetryOwnOptions={onRetryAddresses}
        />
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
          {REGISTER_WIZARD_COPY.payoutHint}
        </Text>
      </div>

      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.ownerKeyLabel}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={REGISTER_WIZARD_COPY.ownerKeyLabel}
            options={REGISTER_WIZARD_OWNER_MODE_OPTIONS}
            value={draft.ownerMode}
            onChange={ownerMode => updateDraft({ ownerMode })}
          />
        </div>
        {draft.ownerMode === 'wallet' ? (
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
            {REGISTER_WIZARD_COPY.ownerWalletNote}
          </Text>
        ) : (
          <RecipientInput
            compact
            value={draft.ownerAddress}
            valueBadge={badgeFor(draft.ownerAddress)}
            onChange={ownerAddress => updateDraft({ ownerAddress })}
            data={MASTERNODE_OWNER_RECIPIENT_COPY}
            ariaLabel={REGISTER_WIZARD_COPY.ownerKeyLabel}
            validate={addr => isValidDashChangeAddress(addr, addressNetwork)}
            ownOptions={addressOptions}
            ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
            ownOptionsLoading={addressesLoading}
            ownOptionsError={addressesError}
            onRetryOwnOptions={onRetryAddresses}
          />
        )}
      </div>

      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.votingKeyLabel}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={REGISTER_WIZARD_COPY.votingKeyLabel}
            options={REGISTER_WIZARD_VOTING_MODE_OPTIONS}
            value={draft.votingMode}
            onChange={votingMode => updateDraft({ votingMode })}
          />
        </div>
        {draft.votingMode === 'wallet' ? (
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
            {REGISTER_WIZARD_COPY.votingWalletNote}
          </Text>
        ) : (
          <RecipientInput
            compact
            value={draft.votingAddress}
            valueBadge={badgeFor(draft.votingAddress)}
            onChange={votingAddress => updateDraft({ votingAddress })}
            data={MASTERNODE_VOTING_RECIPIENT_COPY}
            ariaLabel={REGISTER_WIZARD_COPY.votingKeyLabel}
            validate={addr => isValidDashChangeAddress(addr, addressNetwork)}
            ownOptions={addressOptions}
            ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
            ownOptionsLoading={addressesLoading}
            ownOptionsError={addressesError}
            onRetryOwnOptions={onRetryAddresses}
          />
        )}
      </div>

      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.operatorKeyLabel}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={REGISTER_WIZARD_COPY.operatorKeyLabel}
            options={REGISTER_WIZARD_OPERATOR_MODE_OPTIONS}
            value={draft.operatorMode}
            onChange={operatorMode => updateDraft({ operatorMode })}
          />
        </div>
        {draft.operatorMode === 'wallet' ? (
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
            {REGISTER_WIZARD_COPY.operatorWalletNote}
          </Text>
        ) : (
          <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
            <input
              type={'text'}
              aria-label={REGISTER_WIZARD_COPY.operatorKeyLabel}
              value={draft.operatorPublicKey}
              onChange={e => updateDraft({ operatorPublicKey: e.target.value })}
              placeholder={REGISTER_WIZARD_COPY.operatorExternalPlaceholder}
              className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
            />
          </div>
        )}
      </div>

      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.operatorRewardLabel}</Text>
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={40}>{REGISTER_WIZARD_COPY.operatorRewardPresetsLabel}</Text>
            {OPERATOR_REWARD_PRESETS.map(preset => (
              <button
                key={preset}
                type={'button'}
                onClick={() => updateDraft({ operatorRewardPercent: preset })}
                className={CHIP_ACTION}
              >
                {`${preset}%`}
              </button>
            ))}
          </div>
        </div>
        <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
          <input
            type={'text'}
            aria-label={REGISTER_MASTERNODE_COPY.operatorRewardLabel}
            value={draft.operatorRewardPercent}
            onChange={e => updateDraft({ operatorRewardPercent: e.target.value })}
            placeholder={REGISTER_MASTERNODE_COPY.operatorRewardPlaceholder}
            className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]} tabular-nums`}
          />
        </div>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
          {REGISTER_WIZARD_COPY.operatorRewardHint}
        </Text>

        {rewardBps != null && rewardBps > 0 && (
          <div className={'mt-1 flex flex-col gap-1.5 border-t border-dash-primary-dark-blue/8 pt-3 dark:border-white/10'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY.label}
            </Text>
            <RecipientInput
              compact
              value={draft.operatorPayoutAddress}
              valueBadge={badgeFor(draft.operatorPayoutAddress)}
              onChange={operatorPayoutAddress => updateDraft({ operatorPayoutAddress })}
              data={MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY}
              ariaLabel={MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY.label}
              ownOptions={addressOptions}
              ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
              ownOptionsLoading={addressesLoading}
              ownOptionsError={addressesError}
              onRetryOwnOptions={onRetryAddresses}
            />
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {REGISTER_WIZARD_COPY.operatorPayoutHint}
            </Text>
          </div>
        )}
      </div>

      {validation.customKeyRoles.length > 0 && (
        <Alert
          tone={AlertTone.Info}
          icon={<InfoCircleIcon size={16} color={'currentColor'} />}
          title={REGISTER_WIZARD_COPY.customKeysNoticeTitle}
          description={REGISTER_WIZARD_COPY.customKeysNoticeDescription}
          actions={(
            <Button type={'button'} size={'compact'} colorScheme={'lightBlue-mint'} onClick={onResetWalletKeys}>
              {REGISTER_WIZARD_COPY.useWalletKeys}
            </Button>
          )}
        />
      )}
    </div>
  )
}

export function RegisterStepNetwork({
  draft,
  updateDraft,
  network,
}: RegisterStepSharedProps): React.JSX.Element {
  return (
    <div className={'flex flex-col gap-3'}>
      <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.serviceModeLabel}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={REGISTER_WIZARD_COPY.serviceModeLabel}
            options={REGISTER_WIZARD_SERVICE_MODE_OPTIONS}
            value={draft.serviceMode}
            onChange={serviceMode => updateDraft({ serviceMode })}
          />
        </div>

        {draft.serviceMode === 'later' ? (
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
            {REGISTER_WIZARD_COPY.serviceLaterNote}
          </Text>
        ) : (
          <div className={'grid grid-cols-1 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] sm:items-end gap-3'}>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.serviceIpLabel}</Text>
              <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
                <input
                  type={'text'}
                  aria-label={REGISTER_WIZARD_COPY.serviceIpLabel}
                  value={draft.serviceIp}
                  onChange={e => {
                    const parsed = splitIpPortInput(e.target.value)
                    updateDraft(parsed.port != null
                      ? { serviceIp: parsed.ip, servicePort: parsed.port }
                      : { serviceIp: parsed.ip })
                  }}
                  placeholder={REGISTER_WIZARD_COPY.serviceIpPlaceholder}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
                />
              </div>
            </div>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.servicePortLabel}</Text>
              <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
                <input
                  type={'text'}
                  aria-label={REGISTER_WIZARD_COPY.servicePortLabel}
                  value={draft.servicePort}
                  onChange={e => updateDraft({ servicePort: e.target.value })}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]} tabular-nums`}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {draft.type === EVO_MASTERNODE_TYPE && (
        <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
          <div className={'flex flex-col gap-1.5'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.platformNodeIdLabel}</Text>
            <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
              <input
                type={'text'}
                aria-label={REGISTER_MASTERNODE_COPY.platformNodeIdLabel}
                value={draft.platformNodeId}
                onChange={e => updateDraft({ platformNodeId: e.target.value })}
                placeholder={REGISTER_MASTERNODE_COPY.platformNodeIdPlaceholder}
                className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]}`}
              />
            </div>
          </div>
          <div className={'grid grid-cols-1 sm:grid-cols-2 sm:items-end gap-3'}>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.platformP2PPortLabel}</Text>
              <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
                <input
                  type={'text'}
                  aria-label={REGISTER_MASTERNODE_COPY.platformP2PPortLabel}
                  value={draft.platformP2PPort}
                  onChange={e => updateDraft({ platformP2PPort: e.target.value })}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]} tabular-nums`}
                />
              </div>
            </div>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.platformHttpPortLabel}</Text>
              <div className={`w-full flex items-center ${FIELD_COMPACT}`}>
                <input
                  type={'text'}
                  aria-label={REGISTER_MASTERNODE_COPY.platformHttpPortLabel}
                  value={draft.platformHttpPort}
                  onChange={e => updateDraft({ platformHttpPort: e.target.value })}
                  className={`${ADDRESS_INPUT} ${ADDRESS_INPUT_TEXT_SIZES[14]} tabular-nums`}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {network === 'mainnet' && (
        <Alert
          tone={AlertTone.Info}
          icon={<InfoCircleIcon size={14} />}
          title={REGISTER_WIZARD_COPY.mainnetPortHint}
        />
      )}
    </div>
  )
}

export function RegisterStepReview({
  draft,
  validation,
  badgeFor,
  activeCollateral,
  password,
  onPasswordChange,
  passwordInvalid,
  broadcastError,
  busy,
  canBroadcast,
  onResetWalletKeys,
  onSubmit,
}: RegisterStepReviewProps): React.JSX.Element {
  const { dto, customKeyRoles } = validation
  const payoutBadge = badgeFor(draft.payoutAddress)
  const collateralDisplay = draft.collateralSource === 'wallet'
    ? activeCollateral
    : `${draft.manualTxid.trim()}:${draft.manualVout.trim()}`
  const serviceDisplay = draft.serviceMode === 'later' || dto?.serviceAddress == null
    ? UNASSIGNED_SERVICE_ADDRESS
    : dto.serviceAddress
  const rewardBps = dto?.operatorReward ?? (parseOperatorRewardBps(draft.operatorRewardPercent) ?? 0)

  return (
    <div className={'flex flex-col gap-3'}>
      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.summaryCollateralSection}</Text>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.typeLabel}</Text>
          <Text size={12} weight={'extrabold'} color={'brand'}>{draft.type === 'Evo' ? REGISTER_WIZARD_COPY.evoTitle : REGISTER_WIZARD_COPY.regularTitle}</Text>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.collateralLabel}</Text>
          <HighlightedIdentifier className={'min-w-0 text-xs!'}>{collateralDisplay}</HighlightedIdentifier>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.feeSourceLabel}</Text>
          {draft.feeSourceMode === 'auto' ? (
            <Text size={12} weight={'medium'} color={'brand'}>{REGISTER_WIZARD_COPY.autoFeeSourceValue}</Text>
          ) : (
            <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.feeSourceAddress.trim()}</HighlightedIdentifier>
          )}
        </div>
      </div>

      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.summaryAddressesSection}</Text>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.payoutLabel}</Text>
          <div className={'flex min-w-0 items-center gap-2'}>
            {payoutBadge && <CustomBadge text={payoutBadge} variant={'accent'} size={'xs'} className={'shrink-0'} />}
            <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.payoutAddress.trim()}</HighlightedIdentifier>
          </div>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.ownerKeyLabel}</Text>
          {draft.ownerMode === 'wallet'
            ? <Text size={12} weight={'medium'} color={'brand'}>{REGISTER_WIZARD_COPY.walletDerivedValue}</Text>
            : <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.ownerAddress.trim()}</HighlightedIdentifier>}
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.votingKeyLabel}</Text>
          {draft.votingMode === 'wallet'
            ? <Text size={12} weight={'medium'} color={'brand'}>{REGISTER_WIZARD_COPY.walletDerivedValue}</Text>
            : <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.votingAddress.trim()}</HighlightedIdentifier>}
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.operatorKeyLabel}</Text>
          {draft.operatorMode === 'wallet'
            ? <Text size={12} weight={'medium'} color={'brand'}>{REGISTER_WIZARD_COPY.walletDerivedValue}</Text>
            : <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.operatorPublicKey.trim().toLowerCase()}</HighlightedIdentifier>}
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.operatorRewardLabel}</Text>
          <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{`${(rewardBps / 100).toFixed(2)}%`}</Text>
        </div>
        {rewardBps > 0 && draft.operatorPayoutAddress.trim() !== '' && (
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY.label}</Text>
            <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.operatorPayoutAddress.trim()}</HighlightedIdentifier>
          </div>
        )}
      </div>

      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.summaryNetworkSection}</Text>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.serviceLabel}</Text>
          <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{serviceDisplay}</Text>
        </div>
        {draft.type === EVO_MASTERNODE_TYPE && (
          <>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.platformNodeIdLabel}</Text>
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.platformNodeId.trim().toLowerCase()}</HighlightedIdentifier>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.platformP2PPortLabel}</Text>
              <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{`${draft.platformP2PPort.trim()} / ${draft.platformHttpPort.trim()}`}</Text>
            </div>
          </>
        )}
      </div>

      {customKeyRoles.length > 0 && (
        <Alert
          tone={AlertTone.Warning}
          icon={<InfoCircleIcon size={16} color={'currentColor'} />}
          title={REGISTER_WIZARD_COPY.customKeysNoticeTitle}
          description={REGISTER_WIZARD_COPY.customKeysNoticeDescription}
          actions={(
            <Button type={'button'} size={'compact'} colorScheme={'lightBlue-mint'} onClick={onResetWalletKeys}>
              {REGISTER_WIZARD_COPY.useWalletKeys}
            </Button>
          )}
        />
      )}

      {canBroadcast && (
        <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.authorizeLabel}</Text>
          {broadcastError != null && <CopyableError message={broadcastError} />}
          <PasswordField
            id={'register-masternode-password'}
            value={password}
            onChange={onPasswordChange}
            onSubmit={onSubmit}
            error={passwordInvalid ? INVALID_WALLET_PASSWORD_MESSAGE : null}
            disabled={busy}
          />
        </div>
      )}
    </div>
  )
}

export function RegisterWizardDone({
  result,
  type,
  network,
  onViewNode,
  onDone,
}: RegisterWizardDoneProps): React.JSX.Element {
  return (
    <div className={'flex flex-col gap-5 py-2'}>
      <div className={'flex flex-col items-center text-center gap-2'}>
        <div className={'success-pop'}>
          <SuccessIcon size={56} />
        </div>
        <Text size={18} weight={'extrabold'} color={'brand'}>{REGISTER_WIZARD_COPY.doneHeadline}</Text>
        <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'max-w-lg leading-[140%]'}>
          {REGISTER_WIZARD_COPY.doneDescription}
        </Text>
      </div>

      <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.typeLabel}</Text>
          <Text size={12} weight={'extrabold'} color={'brand'}>{type}</Text>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.networkFee}</Text>
          <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{`${davToDash(result.fee)} ${DASH_UNIT}`}</Text>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.peersAcked}</Text>
          <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{String(result.peersAcked)}</Text>
        </div>
        <HashField
          hash={result.proTxHash}
          label={REGISTER_MASTERNODE_COPY.proTxHashLabel}
          explorerUrl={network == null ? null : transactionUrl(result.proTxHash, network)}
        />
      </div>

      <div className={'flex flex-wrap gap-2'}>
        <Button
          type={'button'}
          variant={'outline'}
          colorScheme={'primary-light'}
          size={'md'}
          onClick={onDone}
          className={'flex-1 rounded-[.9375rem]'}
        >
          {REGISTER_WIZARD_COPY.backToMasternodes}
        </Button>
        <Button
          type={'button'}
          colorScheme={'lightBlue-mint'}
          size={'md'}
          onClick={() => onViewNode(result.proTxHash)}
          className={'flex-1 rounded-[.9375rem]'}
        >
          {REGISTER_WIZARD_COPY.viewNode}
        </Button>
      </div>
    </div>
  )
}
