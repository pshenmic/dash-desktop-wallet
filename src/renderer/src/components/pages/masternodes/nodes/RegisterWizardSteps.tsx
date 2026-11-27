import {
  Button,
  CheckIcon,
  HighlightedIdentifier,
  InfoCircleIcon,
  InfoTooltip,
  SuccessIcon,
  Text,
} from '@renderer/components/dash-ui-kit-extended'
import { EvoServerIcon, ServerIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import RecipientInput from '@renderer/components/pages/transfer/RecipientInput'
import Alert from '@renderer/components/ui/Alert'
import Checkbox from '@renderer/components/ui/Checkbox'
import CopyButton from '@renderer/components/ui/CopyButton'
import CopyableError from '@renderer/components/ui/CopyableError'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import HashField from '@renderer/components/ui/HashField'
import PasswordField from '@renderer/components/ui/PasswordField'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import Spinner from '@renderer/components/ui/Spinner'
import { INVALID_WALLET_PASSWORD_MESSAGE } from '@renderer/constants'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  MASTERNODE_FEE_SOURCE_RECIPIENT_COPY,
  MASTERNODE_FUNDED_ADDRESSES_HEADING,
  MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY,
  MASTERNODE_OWNER_RECIPIENT_COPY,
  MASTERNODE_PAYOUT_RECIPIENT_COPY,
  MASTERNODE_VOTING_RECIPIENT_COPY,
  MASTERNODE_YOUR_ADDRESSES_HEADING,
} from '@renderer/constants/masternodeAddresses'
import { REGISTER_MASTERNODE_COPY } from '@renderer/constants/masternodeNodes'
import { MASTERNODE_COLLATERAL_PREP_COPY } from '@renderer/constants/masternodeCollateralPrep'
import {
  COMBINE_COLLATERAL_SELECTION,
  MASTERNODE_TYPE_CARDS,
  OPERATOR_REWARD_PRESETS,
  REGISTER_WIZARD_COLLATERAL_SOURCE_OPTIONS,
  REGISTER_WIZARD_COPY,
  REGISTER_WIZARD_OPERATOR_MODE_OPTIONS,
  REGISTER_WIZARD_OWNER_MODE_OPTIONS,
  REGISTER_WIZARD_PAYOUT_MODE_OPTIONS,
  REGISTER_WIZARD_SERVICE_MODE_OPTIONS,
  REGISTER_WIZARD_TOOLTIPS,
  REGISTER_WIZARD_VOTING_MODE_OPTIONS,
} from '@renderer/constants/masternodeRegistration'
import {
  EVO_MASTERNODE_TYPE,
  UNASSIGNED_SERVICE_ADDRESS,
} from '@renderer/constants/masternodes'
import { CHIP_ACTION, SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { AlertTone } from '@renderer/enums/AlertTone'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import type {
  RegisterStepCollateralProps,
  RegisterStepNodeTypeProps,
  RegisterStepReviewProps,
  RegisterStepSharedProps,
  RegisterWizardDoneProps,
} from '@renderer/types/MasternodeRegistrationWizard'
import {
  isValidDashAddress,
  isValidDashChangeAddress,
} from '@renderer/utils/address'
import { davToDash } from '@renderer/utils/balance'
import { transactionUrl } from '@renderer/utils/explorer'
import {
  isConfirmingUtxo,
  isValidBlsPublicKey,
  isValidPlatformNodeId,
  isValidPortText,
  parseOperatorRewardBps,
  parseOutpoint,
  splitIpPortInput,
  validateServiceEndpoint,
} from '@renderer/utils/masternodeActions'
import MasternodeFieldInput from './MasternodeFieldInput'

export function RegisterStepNodeType({
  draft,
  updateDraft,
}: RegisterStepNodeTypeProps): React.JSX.Element {
  return (
    <div className={'flex flex-col gap-3'}>
      <div className={'flex flex-col gap-1'}>
        <div className={'flex items-center gap-1.5'}>
          <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_MASTERNODE_COPY.typeLabel}</Text>
          <InfoTooltip
            content={REGISTER_WIZARD_TOOLTIPS.nodeType}
            ariaLabel={REGISTER_MASTERNODE_COPY.typeLabel}
            className={'size-4 [&_svg]:size-3.5'}
          />
        </div>
        <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'leading-[135%]'}>
          {REGISTER_WIZARD_COPY.nodeTypeStepDescription}
        </Text>
      </div>
      <div className={'grid grid-cols-1 sm:grid-cols-2 gap-3'}>
        {MASTERNODE_TYPE_CARDS.map(card => {
          const active = draft.type === card.type
          const TypeIcon = card.type === EVO_MASTERNODE_TYPE ? EvoServerIcon : ServerIcon
          return (
            <button
              key={card.type}
              type={'button'}
              aria-pressed={active}
              onClick={() => updateDraft({ type: card.type })}
              className={`flex flex-col items-stretch justify-between gap-3 rounded-[.9375rem] border p-4 text-left transition-colors cursor-pointer ${
                active
                  ? 'border-dash-brand dark:border-dash-mint dash-block-accent-5'
                  : 'border-dash-primary-dark-blue/10 dark:border-white/10 dash-block-5 hover:dash-block-10'
              }`}
            >
              <div className={'flex flex-col gap-2.5'}>
                <div className={'flex items-center justify-between gap-2'}>
                  <div className={'flex items-center gap-2'}>
                    <span
                      aria-hidden={'true'}
                      className={`flex size-8 shrink-0 items-center justify-center rounded-[.625rem] border ${
                        active
                          ? 'border-dash-brand/25 bg-dash-brand/10 text-dash-brand dark:border-dash-mint/30 dark:bg-dash-mint/10 dark:text-dash-mint'
                          : 'border-dash-primary-dark-blue/10 bg-dash-primary-dark-blue/[0.04] text-dash-primary-dark-blue/65 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/65'
                      }`}
                    >
                      <TypeIcon size={15} color={'currentColor'} />
                    </span>
                    <CustomBadge variant={active ? 'accent' : 'muted'} size={'xs'} text={card.layerBadge} />
                  </div>
                  <span
                    aria-hidden={'true'}
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      active
                        ? 'border-dash-brand bg-dash-brand text-white dark:border-dash-mint dark:bg-dash-mint dark:text-dash-primary-dark-blue'
                        : 'border-dash-primary-dark-blue/20 dark:border-white/20'
                    }`}
                  >
                    {active && <CheckIcon size={12} color={'currentColor'} className={'[&_circle]:hidden'} />}
                  </span>
                </div>

                <div className={'flex flex-col gap-1'}>
                  <Text size={16} weight={'extrabold'} color={active ? 'blue-mint' : 'brand'}>{card.title}</Text>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'leading-[135%]'}>
                    {card.summary}
                  </Text>
                </div>

                <div className={'grid grid-cols-3 gap-2 rounded-[.75rem] border border-dash-primary-dark-blue/[0.07] bg-dash-primary-dark-blue/[0.025] px-2.5 py-2 dark:border-white/[0.08] dark:bg-white/[0.03]'}>
                  <div className={'flex flex-col gap-0.5 min-w-0'}>
                    <Text reset size={10} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.collateralCardLabel}</Text>
                    <Text reset size={12} weight={'bold'} color={'brand'} className={'tabular-nums whitespace-nowrap'}>{card.amount}</Text>
                  </div>
                  <div className={'flex flex-col gap-0.5 min-w-0'}>
                    <Text reset size={10} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.apyLabel}</Text>
                    <Text reset size={12} weight={'extrabold'} color={'blue-mint'} className={'tabular-nums whitespace-nowrap'}>{card.estimatedApy}</Text>
                  </div>
                  <div className={'flex flex-col gap-0.5 min-w-0'}>
                    <Text reset size={10} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.votingCardLabel}</Text>
                    <Text reset size={12} weight={'bold'} color={'brand'} className={'tabular-nums whitespace-nowrap'}>{card.votingWeight}</Text>
                  </div>
                </div>
              </div>

              <ul className={'flex flex-col gap-1 pt-0.5'}>
                {card.highlights.map(item => (
                  <li key={item} className={'flex items-start gap-1.5'}>
                    <span
                      aria-hidden={'true'}
                      className={`mt-1.5 size-1 shrink-0 rounded-full ${active ? 'bg-dash-brand dark:bg-dash-mint' : 'bg-dash-primary-dark-blue/35 dark:bg-white/35'}`}
                    />
                    <Text reset size={10} weight={'medium'} color={'brand'} opacity={60} className={'leading-[140%]'}>
                      {item}
                    </Text>
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      <div className={'flex items-start gap-2 px-1'}>
        <InfoCircleIcon size={14} color={'currentColor'} className={'mt-0.5 shrink-0 text-dash-primary-dark-blue/45 dark:text-white/45'} />
        <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'leading-[140%]'}>
          {REGISTER_WIZARD_COPY.apyDisclaimer}
        </Text>
      </div>
    </div>
  )
}

export function RegisterStepCollateral({
  draft,
  updateDraft,
  validation,
  resolvedCollateralSource,
  prepareSection,
}: RegisterStepCollateralProps): React.JSX.Element {
  const confirming = validation.selectedCoin != null && isConfirmingUtxo(validation.selectedCoin)

  return (
    <div className={'flex flex-col gap-3'}>
      <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_MASTERNODE_COPY.collateralLabel}</Text>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.collateralStep}
              ariaLabel={REGISTER_MASTERNODE_COPY.collateralLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={REGISTER_WIZARD_COPY.collateralSourceLabel}
            options={REGISTER_WIZARD_COLLATERAL_SOURCE_OPTIONS}
            value={resolvedCollateralSource}
            onChange={collateralSource => updateDraft({ collateralSource })}
          />
        </div>

        {resolvedCollateralSource === 'prepare' ? (
          <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'leading-[135%]'}>
            {MASTERNODE_COLLATERAL_PREP_COPY.sectionDescription}
          </Text>
        ) : (
          <div className={'grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end gap-3'}>
            <div className={'flex flex-col gap-1.5'}>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.manualTxidLabel}</Text>
                <InfoTooltip
                  content={REGISTER_WIZARD_TOOLTIPS.manualTxid}
                  ariaLabel={REGISTER_WIZARD_COPY.manualTxidLabel}
                  className={'size-4 [&_svg]:size-3.5'}
                />
              </div>
              <MasternodeFieldInput
                value={draft.manualTxid}
                onChange={manualTxid => updateDraft({ manualTxid })}
                ariaLabel={REGISTER_WIZARD_COPY.manualTxidLabel}
                placeholder={REGISTER_WIZARD_COPY.manualTxidPlaceholder}
                invalid={draft.manualTxid.trim() !== '' && parseOutpoint(`${draft.manualTxid.trim()}:0`) == null}
              />
            </div>
            <div className={'flex flex-col gap-1.5'}>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.manualVoutLabel}</Text>
                <InfoTooltip
                  content={REGISTER_WIZARD_TOOLTIPS.manualVout}
                  ariaLabel={REGISTER_WIZARD_COPY.manualVoutLabel}
                  className={'size-4 [&_svg]:size-3.5'}
                />
              </div>
              <MasternodeFieldInput
                value={draft.manualVout}
                onChange={manualVout => updateDraft({ manualVout })}
                ariaLabel={REGISTER_WIZARD_COPY.manualVoutLabel}
                placeholder={REGISTER_WIZARD_COPY.manualVoutPlaceholder}
                tabular
                invalid={draft.manualVout.trim() !== '' && parseOutpoint(`${'0'.repeat(64)}:${draft.manualVout.trim()}`) == null}
              />
            </div>
          </div>
        )}

        {confirming && resolvedCollateralSource === 'manual' && (
          <Alert
            tone={AlertTone.Warning}
            icon={<InfoCircleIcon size={14} />}
            title={REGISTER_MASTERNODE_COPY.confirmingCollateralTitle}
            description={REGISTER_MASTERNODE_COPY.confirmingCollateralDescription}
          />
        )}

        {resolvedCollateralSource === 'manual' && validation.manualOutpointMissingFromWallet && (
          <Alert
            tone={AlertTone.Info}
            icon={<InfoCircleIcon size={14} />}
            title={REGISTER_WIZARD_COPY.manualOutpointMissingTitle}
            description={REGISTER_WIZARD_COPY.manualOutpointMissingDescription}
          />
        )}
      </div>

      {resolvedCollateralSource === 'prepare' && prepareSection}
    </div>
  )
}

export function RegisterStepAddresses({
  draft,
  updateDraft,
  network,
  defaultPayoutAddress,
  addressOptions,
  badgeFor,
  addressesLoading,
  addressesError,
  onRetryAddresses,
}: RegisterStepSharedProps): React.JSX.Element {
  const addressNetwork = network ?? undefined
  const rewardBps = parseOperatorRewardBps(draft.operatorRewardPercent)
  const walletPayoutBadge = defaultPayoutAddress != null ? badgeFor(defaultPayoutAddress) : undefined

  return (
    <div className={'flex flex-col gap-3'}>
      <div className={'flex items-center gap-1.5 px-1'}>
        <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.summaryAddressesSection}</Text>
        <InfoTooltip
          content={REGISTER_WIZARD_TOOLTIPS.addressesStep}
          ariaLabel={REGISTER_WIZARD_COPY.summaryAddressesSection}
          className={'size-4 [&_svg]:size-3.5'}
        />
      </div>

      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.payoutKeyLabel}</Text>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.payoutKey}
              ariaLabel={REGISTER_WIZARD_COPY.payoutKeyLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={REGISTER_WIZARD_COPY.payoutKeyLabel}
            options={REGISTER_WIZARD_PAYOUT_MODE_OPTIONS}
            value={draft.payoutMode}
            onChange={payoutMode => updateDraft({ payoutMode })}
          />
        </div>
        {draft.payoutMode === 'wallet' ? (
          defaultPayoutAddress != null ? (
            <>
              <div className={'flex flex-wrap items-center gap-2 rounded-[.875rem] dash-block px-3.5 py-2.5'}>
                <HighlightedIdentifier className={'min-w-0 text-xs!'}>{defaultPayoutAddress}</HighlightedIdentifier>
                {walletPayoutBadge && <CustomBadge text={walletPayoutBadge} variant={'accent'} size={'xs'} className={'shrink-0'} />}
              </div>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
                {REGISTER_WIZARD_COPY.payoutWalletNote}
              </Text>
            </>
          ) : (
            <Text size={12} weight={'medium'} color={'brand'} opacity={60}>
              {REGISTER_WIZARD_COPY.payoutWalletEmpty}
            </Text>
          )
        ) : (
          <>
            <RecipientInput
              compact
              value={draft.payoutAddress}
              valueBadge={badgeFor(draft.payoutAddress)}
              onChange={payoutAddress => updateDraft({ payoutAddress })}
              data={MASTERNODE_PAYOUT_RECIPIENT_COPY}
              ariaLabel={REGISTER_MASTERNODE_COPY.payoutLabel}
              validate={addr => isValidDashAddress(addr, addressNetwork)}
              ownOptions={addressOptions}
              ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
              ownOptionsLoading={addressesLoading}
              ownOptionsError={addressesError}
              onRetryOwnOptions={onRetryAddresses}
            />
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {REGISTER_WIZARD_COPY.payoutHint}
            </Text>
          </>
        )}
      </div>

      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.ownerKeyLabel}</Text>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.ownerKey}
              ariaLabel={REGISTER_WIZARD_COPY.ownerKeyLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
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
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.votingKeyLabel}</Text>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.votingKey}
              ariaLabel={REGISTER_WIZARD_COPY.votingKeyLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
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
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.operatorKeyLabel}</Text>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.operatorKey}
              ariaLabel={REGISTER_WIZARD_COPY.operatorKeyLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
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
          <MasternodeFieldInput
            value={draft.operatorPublicKey}
            onChange={operatorPublicKey => updateDraft({ operatorPublicKey })}
            ariaLabel={REGISTER_WIZARD_COPY.operatorKeyLabel}
            placeholder={REGISTER_WIZARD_COPY.operatorExternalPlaceholder}
            invalid={draft.operatorPublicKey.trim() !== '' && !isValidBlsPublicKey(draft.operatorPublicKey)}
          />
        )}
      </div>

      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_MASTERNODE_COPY.operatorRewardLabel}</Text>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.operatorReward}
              ariaLabel={REGISTER_MASTERNODE_COPY.operatorRewardLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
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
        <MasternodeFieldInput
          value={draft.operatorRewardPercent}
          onChange={operatorRewardPercent => updateDraft({ operatorRewardPercent })}
          ariaLabel={REGISTER_MASTERNODE_COPY.operatorRewardLabel}
          placeholder={REGISTER_MASTERNODE_COPY.operatorRewardPlaceholder}
          tabular
          suffix={'%'}
          invalid={draft.operatorRewardPercent.trim() !== '' && rewardBps == null}
        />
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
          {REGISTER_WIZARD_COPY.operatorRewardHint}
        </Text>

        {rewardBps != null && rewardBps > 0 && (
          <div className={'mt-1 flex flex-col gap-1.5 border-t border-dash-primary-dark-blue/8 pt-3 dark:border-white/10'}>
            <div className={'flex items-center gap-1.5'}>
              <Text size={12} weight={'bold'} color={'brand'}>
                {MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY.label}
              </Text>
              <InfoTooltip
                content={REGISTER_WIZARD_TOOLTIPS.operatorPayout}
                ariaLabel={MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY.label}
                className={'size-4 [&_svg]:size-3.5'}
              />
            </div>
            <RecipientInput
              compact
              value={draft.operatorPayoutAddress}
              valueBadge={badgeFor(draft.operatorPayoutAddress)}
              onChange={operatorPayoutAddress => updateDraft({ operatorPayoutAddress })}
              data={MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY}
              ariaLabel={MASTERNODE_OPERATOR_PAYOUT_RECIPIENT_COPY.label}
              validate={addr => addr.trim() === '' || isValidDashAddress(addr, addressNetwork)}
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
      <div className={'flex items-center gap-1.5 px-1'}>
        <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.summaryNetworkSection}</Text>
        <InfoTooltip
          content={REGISTER_WIZARD_TOOLTIPS.networkStep}
          ariaLabel={REGISTER_WIZARD_COPY.summaryNetworkSection}
          className={'size-4 [&_svg]:size-3.5'}
        />
      </div>

      <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.serviceModeLabel}</Text>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.serviceEndpoint}
              ariaLabel={REGISTER_WIZARD_COPY.serviceModeLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
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
              <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.serviceIpLabel}</Text>
              <MasternodeFieldInput
                value={draft.serviceIp}
                onChange={value => {
                  const parsed = splitIpPortInput(value)
                  updateDraft(parsed.port != null
                    ? { serviceIp: parsed.ip, servicePort: parsed.port }
                    : { serviceIp: parsed.ip })
                }}
                ariaLabel={REGISTER_WIZARD_COPY.serviceIpLabel}
                placeholder={REGISTER_WIZARD_COPY.serviceIpPlaceholder}
                invalid={draft.serviceIp.trim() !== '' && validateServiceEndpoint(`${draft.serviceIp.trim()}:${draft.servicePort.trim() || '1'}`, network).error != null && isValidPortText(draft.servicePort)}
              />
            </div>
            <div className={'flex flex-col gap-1.5'}>
              <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.servicePortLabel}</Text>
              <MasternodeFieldInput
                value={draft.servicePort}
                onChange={servicePort => updateDraft({ servicePort })}
                ariaLabel={REGISTER_WIZARD_COPY.servicePortLabel}
                tabular
                invalid={draft.servicePort.trim() !== '' && !isValidPortText(draft.servicePort)}
              />
            </div>
          </div>
        )}
      </div>

      {draft.type === EVO_MASTERNODE_TYPE && (
        <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
          <div className={'flex flex-col gap-1.5'}>
            <div className={'flex items-center gap-1.5'}>
              <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_MASTERNODE_COPY.platformNodeIdLabel}</Text>
              <InfoTooltip
                content={REGISTER_WIZARD_TOOLTIPS.platformNodeId}
                ariaLabel={REGISTER_MASTERNODE_COPY.platformNodeIdLabel}
                className={'size-4 [&_svg]:size-3.5'}
              />
            </div>
            <MasternodeFieldInput
              value={draft.platformNodeId}
              onChange={platformNodeId => updateDraft({ platformNodeId })}
              ariaLabel={REGISTER_MASTERNODE_COPY.platformNodeIdLabel}
              placeholder={REGISTER_MASTERNODE_COPY.platformNodeIdPlaceholder}
              invalid={draft.platformNodeId.trim() !== '' && !isValidPlatformNodeId(draft.platformNodeId)}
            />
          </div>
          <div className={'grid grid-cols-1 sm:grid-cols-2 sm:items-end gap-3'}>
            <div className={'flex flex-col gap-1.5'}>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_MASTERNODE_COPY.platformP2PPortLabel}</Text>
                <InfoTooltip
                  content={REGISTER_WIZARD_TOOLTIPS.platformPorts}
                  ariaLabel={REGISTER_MASTERNODE_COPY.platformP2PPortLabel}
                  className={'size-4 [&_svg]:size-3.5'}
                />
              </div>
              <MasternodeFieldInput
                value={draft.platformP2PPort}
                onChange={platformP2PPort => updateDraft({ platformP2PPort })}
                ariaLabel={REGISTER_MASTERNODE_COPY.platformP2PPortLabel}
                tabular
                invalid={draft.platformP2PPort.trim() !== '' && !isValidPortText(draft.platformP2PPort)}
              />
            </div>
            <div className={'flex flex-col gap-1.5'}>
              <div className={'flex items-center gap-1.5'}>
                <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_MASTERNODE_COPY.platformHttpPortLabel}</Text>
                <InfoTooltip
                  content={REGISTER_WIZARD_TOOLTIPS.platformPorts}
                  ariaLabel={REGISTER_MASTERNODE_COPY.platformHttpPortLabel}
                  className={'size-4 [&_svg]:size-3.5'}
                />
              </div>
              <MasternodeFieldInput
                value={draft.platformHttpPort}
                onChange={platformHttpPort => updateDraft({ platformHttpPort })}
                ariaLabel={REGISTER_MASTERNODE_COPY.platformHttpPortLabel}
                tabular
                invalid={draft.platformHttpPort.trim() !== '' && !isValidPortText(draft.platformHttpPort)}
              />
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
  updateDraft,
  validation,
  network,
  defaultPayoutAddress,
  fundedFeeOptions,
  badgeFor,
  addressesLoading,
  addressesError,
  onRetryAddresses,
  activeCollateral,
  preview,
  previewLoading,
  previewError,
  customFeeError,
  onRetryPreview,
  password,
  onPasswordChange,
  passwordInvalid,
  broadcastError,
  busy,
  canBroadcast,
  onSubmit,
}: RegisterStepReviewProps): React.JSX.Element {
  const addressNetwork = network ?? undefined
  const { dto } = validation
  const resolvedPayout = dto?.payoutAddress
    ?? (draft.payoutMode === 'wallet' ? (defaultPayoutAddress ?? '') : draft.payoutAddress.trim())
  const payoutBadge = resolvedPayout !== '' ? badgeFor(resolvedPayout) : undefined
  const collateralDisplay = draft.collateralSource !== 'manual'
    ? (activeCollateral !== '' && activeCollateral !== COMBINE_COLLATERAL_SELECTION ? activeCollateral : '—')
    : `${draft.manualTxid.trim()}:${draft.manualVout.trim()}`
  const serviceDisplay = draft.serviceMode === 'later' || dto?.serviceAddress == null
    ? UNASSIGNED_SERVICE_ADDRESS
    : dto.serviceAddress
  const rewardBps = dto?.operatorReward ?? (parseOperatorRewardBps(draft.operatorRewardPercent) ?? 0)
  const changeTotal = preview?.outputs.reduce((sum, entry) => sum + entry.amount, 0n) ?? 0n

  return (
    <div className={'flex flex-col gap-3'}>
      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <div className={'flex items-center gap-1.5'}>
          <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.summaryCollateralSection}</Text>
          <InfoTooltip
            content={REGISTER_WIZARD_TOOLTIPS.reviewStep}
            ariaLabel={REGISTER_WIZARD_COPY.summaryCollateralSection}
            className={'size-4 [&_svg]:size-3.5'}
          />
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.typeLabel}</Text>
          <Text size={12} weight={'extrabold'} color={'brand'}>{draft.type === 'Evo' ? REGISTER_WIZARD_COPY.evoTitle : REGISTER_WIZARD_COPY.regularTitle}</Text>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.collateralLabel}</Text>
          <HighlightedIdentifier className={'min-w-0 text-xs!'}>{collateralDisplay}</HighlightedIdentifier>
        </div>
      </div>

      <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
        <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.summaryAddressesSection}</Text>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.payoutLabel}</Text>
          <div className={'flex min-w-0 items-center gap-2'}>
            {payoutBadge && <CustomBadge text={payoutBadge} variant={'accent'} size={'xs'} className={'shrink-0'} />}
            <HighlightedIdentifier className={'min-w-0 text-xs!'}>{resolvedPayout || '—'}</HighlightedIdentifier>
          </div>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.ownerKeyLabel}</Text>
          <div className={'flex min-w-0 items-center gap-2'}>
            {preview != null ? (
              <>
                <CustomBadge
                  variant={preview.ownerKeyIndex != null ? 'accent' : 'muted'}
                  text={preview.ownerKeyIndex != null ? `${REGISTER_WIZARD_COPY.walletKeyIndexPrefix}${preview.ownerKeyIndex}` : REGISTER_WIZARD_COPY.customKeyBadge}
                  className={'shrink-0'}
                />
                <HighlightedIdentifier className={'min-w-0 text-xs!'}>{preview.ownerAddress}</HighlightedIdentifier>
              </>
            ) : draft.ownerMode === 'wallet' ? (
              <Text size={12} weight={'medium'} color={'brand'}>{REGISTER_WIZARD_COPY.walletDerivedValue}</Text>
            ) : (
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.ownerAddress.trim()}</HighlightedIdentifier>
            )}
          </div>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.votingKeyLabel}</Text>
          <div className={'flex min-w-0 items-center gap-2'}>
            {preview != null ? (
              <>
                <CustomBadge
                  variant={preview.votingKeyIndex != null ? 'accent' : 'muted'}
                  text={preview.votingKeyIndex != null ? `${REGISTER_WIZARD_COPY.walletKeyIndexPrefix}${preview.votingKeyIndex}` : REGISTER_WIZARD_COPY.customKeyBadge}
                  className={'shrink-0'}
                />
                <HighlightedIdentifier className={'min-w-0 text-xs!'}>{preview.votingAddress}</HighlightedIdentifier>
              </>
            ) : draft.votingMode === 'wallet' ? (
              <Text size={12} weight={'medium'} color={'brand'}>{REGISTER_WIZARD_COPY.walletDerivedValue}</Text>
            ) : (
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.votingAddress.trim()}</HighlightedIdentifier>
            )}
          </div>
        </div>
        <div className={'flex items-center justify-between gap-4'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.operatorKeyLabel}</Text>
          <div className={'flex min-w-0 items-center gap-2'}>
            {preview != null ? (
              <>
                <CustomBadge
                  variant={preview.operatorKeyIndex != null ? 'accent' : 'muted'}
                  text={preview.operatorKeyIndex != null ? `${REGISTER_WIZARD_COPY.walletKeyIndexPrefix}${preview.operatorKeyIndex}` : REGISTER_WIZARD_COPY.customKeyBadge}
                  className={'shrink-0'}
                />
                <HighlightedIdentifier className={'min-w-0 text-xs!'}>{preview.operatorPublicKey}</HighlightedIdentifier>
              </>
            ) : draft.operatorMode === 'wallet' ? (
              <Text size={12} weight={'medium'} color={'brand'}>{REGISTER_WIZARD_COPY.walletDerivedValue}</Text>
            ) : (
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{draft.operatorPublicKey.trim().toLowerCase()}</HighlightedIdentifier>
            )}
          </div>
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
        <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.summaryNetworkSection}</Text>
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

      <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
        <div className={'flex flex-wrap items-center justify-between gap-2'}>
          <div className={'flex items-center gap-1.5'}>
            <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.previewTransactionSection}</Text>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.feePreview}
              ariaLabel={REGISTER_WIZARD_COPY.previewTransactionSection}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
          <div className={'flex items-center gap-1.5'}>
            <Checkbox
              appearance={'subtle'}
              className={'flex-row-reverse!'}
              checked={draft.feeSourceMode === 'address'}
              onChange={checked => updateDraft({ feeSourceMode: checked ? 'address' : 'auto' })}
              label={<Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_WIZARD_COPY.customFeesCheckboxLabel}</Text>}
            />
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.customFees}
              ariaLabel={REGISTER_WIZARD_COPY.customFeesCheckboxLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
        </div>

        {draft.feeSourceMode === 'address' && (
          <div className={'flex flex-col gap-2'}>
            <RecipientInput
              compact
              hideAddressBook
              value={draft.feeSourceAddress}
              valueBadge={badgeFor(draft.feeSourceAddress)}
              onChange={feeSourceAddress => updateDraft({ feeSourceAddress })}
              data={MASTERNODE_FEE_SOURCE_RECIPIENT_COPY}
              ariaLabel={REGISTER_WIZARD_COPY.feeSourceLabel}
              validate={addr => isValidDashChangeAddress(addr, addressNetwork)}
              ownOptions={fundedFeeOptions}
              ownOptionsHeading={MASTERNODE_FUNDED_ADDRESSES_HEADING}
              ownOptionsLoading={addressesLoading}
              ownOptionsError={addressesError}
              onRetryOwnOptions={onRetryAddresses}
            />
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
              {REGISTER_WIZARD_COPY.customFeesHint}
            </Text>
            {customFeeError != null && (draft.feeSourceAddress.trim() !== '' || fundedFeeOptions.length === 0) && (
              <Alert
                tone={AlertTone.Warning}
                icon={<InfoCircleIcon size={16} color={'currentColor'} />}
                title={fundedFeeOptions.length === 0 && draft.feeSourceAddress.trim() === ''
                  ? REGISTER_WIZARD_COPY.customFeesNoEligibleCoins
                  : customFeeError}
              />
            )}
          </div>
        )}

        {previewLoading && (
          <div className={'flex items-center gap-2.5 pt-1'} role={'status'}>
            <Spinner size={16} className={'dash-text-primary'} />
            <Text size={12} weight={'medium'} color={'brand'} opacity={70}>{REGISTER_WIZARD_COPY.previewLoadingLabel}</Text>
          </div>
        )}

        {!previewLoading && previewError != null && (
          <Alert
            tone={AlertTone.Warning}
            icon={<InfoCircleIcon size={16} color={'currentColor'} />}
            title={REGISTER_WIZARD_COPY.previewErrorTitle}
            description={previewError}
            actions={(
              <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={onRetryPreview}>
                {REGISTER_WIZARD_COPY.retryButton}
              </Button>
            )}
          />
        )}

        {!previewLoading && preview != null && (
          <>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_MASTERNODE_COPY.networkFee}</Text>
              <Text size={12} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>{`${davToDash(preview.feeDuffs)} ${DASH_UNIT}`}</Text>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.feeInputsLabel}</Text>
              <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                {`${preview.inputs.length} · ${davToDash(preview.inputs.reduce((sum, entry) => sum + entry.amount, 0n))} ${DASH_UNIT}`}
              </Text>
            </div>
            {preview.outputs.length > 0 && (
              <div className={'flex items-center justify-between gap-4'}>
                <Text size={12} weight={'medium'} color={'brand'} opacity={60}>{REGISTER_WIZARD_COPY.changeOutputLabel}</Text>
                <div className={'flex min-w-0 items-center gap-2'}>
                  <HighlightedIdentifier className={'min-w-0 text-xs!'}>{preview.outputs[0].address}</HighlightedIdentifier>
                  <Text size={12} weight={'medium'} color={'brand'} className={'shrink-0 tabular-nums'}>{`${davToDash(changeTotal)} ${DASH_UNIT}`}</Text>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!previewLoading && preview != null && (
        <details className={SURFACE_SECTION}>
          <summary className={'cursor-pointer text-xs font-bold text-dash-primary-dark-blue dark:text-white'}>
            {REGISTER_WIZARD_COPY.unsignedHexSummary}
          </summary>
          <div className={'mt-3 flex flex-col gap-2'}>
            <div className={'flex items-center justify-between gap-2'}>
              <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.unsignedHexLabel}</Text>
              <CopyButton text={preview.unsignedHex} />
            </div>
            <textarea
              readOnly
              value={preview.unsignedHex}
              aria-label={REGISTER_WIZARD_COPY.unsignedHexSummary}
              rows={4}
              className={`w-full resize-y ${SURFACE_ROW} dash-text-default font-mono text-xs break-all outline-none focus-visible:ring-2 focus-visible:ring-dash-brand/40 dark:focus-visible:ring-white/40`}
            />
          </div>
        </details>
      )}

      {canBroadcast && (
        <div className={`flex flex-col gap-3 ${SURFACE_SECTION}`}>
          <div className={'flex items-center gap-1.5'}>
            <label htmlFor={'register-masternode-password'}>
              <Text size={12} weight={'bold'} color={'brand'}>{REGISTER_WIZARD_COPY.authorizeLabel}</Text>
            </label>
            <InfoTooltip
              content={REGISTER_WIZARD_TOOLTIPS.authorize}
              ariaLabel={REGISTER_WIZARD_COPY.authorizeLabel}
              className={'size-4 [&_svg]:size-3.5'}
            />
          </div>
          {broadcastError != null && <CopyableError message={broadcastError} />}
          <PasswordField
            id={'register-masternode-password'}
            hideLabel
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
