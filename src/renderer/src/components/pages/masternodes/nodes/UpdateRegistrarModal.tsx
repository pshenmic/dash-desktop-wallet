import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { MasternodeUpdateResult } from '@renderer/api/types'
import { HighlightedIdentifier, InfoCircleIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import RecipientInput from '@renderer/components/pages/transfer/RecipientInput'
import Alert from '@renderer/components/ui/Alert'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  MASTERNODE_PAYOUT_RECIPIENT_COPY,
  MASTERNODE_VOTING_RECIPIENT_COPY,
  MASTERNODE_YOUR_ADDRESSES_HEADING,
} from '@renderer/constants/masternodeAddresses'
import {
  PAYOUT_CHOICE_OPTIONS,
  REGISTER_MASTERNODE_COPY,
  REGISTRAR_KEY_CHOICE_OPTIONS,
  UPDATE_REGISTRAR_COPY,
} from '@renderer/constants/masternodeNodes'
import { SURFACE_SECTION } from '@renderer/constants/surfaces'
import { useAuth } from '@renderer/contexts/AuthContext'
import { AlertTone } from '@renderer/enums/AlertTone'
import { PayoutChoiceKind, RegistrarKeyChoiceKind } from '@renderer/enums/Masternodes'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { refreshMasternodes } from '@renderer/hooks/useMasternodes'
import { useWalletAddressOptions } from '@renderer/hooks/useWalletAddressOptions'
import { refreshBalance } from '@renderer/hooks/useWalletBalance'
import type { UpdateRegistrarModalProps } from '@renderer/types/MasternodeNodes'
import { isValidDashAddress, isValidDashChangeAddress } from '@renderer/utils/address'
import { davToDash } from '@renderer/utils/balance'
import { transactionUrl } from '@renderer/utils/explorer'
import { buildRegistrarUpdate, isValidBlsPublicKey } from '@renderer/utils/masternodeActions'
import MasternodeFieldInput from './MasternodeFieldInput'

export default function UpdateRegistrarModal({
  walletId,
  node,
  open,
  onClose,
}: UpdateRegistrarModalProps): React.JSX.Element {
  const { status } = useAuth()
  const network = status?.network ?? null
  const {
    options: addressOptions,
    badgeFor,
    loading: addressesLoading,
    err: addressesError,
    retry: retryAddresses,
  } = useWalletAddressOptions(open ? walletId : undefined)
  const [payoutChoice, setPayoutChoice] = useState<PayoutChoiceKind>(
    node.payeeAddress != null ? PayoutChoiceKind.Keep : PayoutChoiceKind.Custom,
  )
  const [payoutAddress, setPayoutAddress] = useState(node.payeeAddress ?? '')
  const [operatorChoice, setOperatorChoice] = useState<RegistrarKeyChoiceKind>(RegistrarKeyChoiceKind.Keep)
  const [operatorPublicKey, setOperatorPublicKey] = useState('')
  const [votingChoice, setVotingChoice] = useState<RegistrarKeyChoiceKind>(RegistrarKeyChoiceKind.Keep)
  const [votingAddress, setVotingAddress] = useState('')

  const { dto, error } = useMemo(
    () => buildRegistrarUpdate({
      payoutChoice,
      payoutAddress,
      currentPayeeAddress: node.payeeAddress,
      operatorChoice,
      operatorPublicKey,
      votingChoice,
      votingAddress,
    }),
    [payoutChoice, payoutAddress, node.payeeAddress, operatorChoice, operatorPublicKey, votingChoice, votingAddress],
  )

  const run = async (password: string): Promise<MasternodeUpdateResult> => {
    const result = await API.updateMasternodeRegistrar(walletId, node.proTxHash, dto!, password)
    void refreshMasternodes(walletId)
    void refreshBalance(walletId)
    return result
  }

  const editContent = (
    <div className={'mt-4 flex flex-col gap-3'}>
      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <div className={'flex items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_REGISTRAR_COPY.payoutSection}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={UPDATE_REGISTRAR_COPY.payoutSection}
            options={PAYOUT_CHOICE_OPTIONS}
            value={payoutChoice}
            onChange={setPayoutChoice}
          />
        </div>
        {payoutChoice === PayoutChoiceKind.Keep && node.payeeAddress != null && (
          <HighlightedIdentifier className={'min-w-0 text-xs!'}>{node.payeeAddress}</HighlightedIdentifier>
        )}
        {payoutChoice === PayoutChoiceKind.Custom && (
          <RecipientInput
            compact
            value={payoutAddress}
            valueBadge={badgeFor(payoutAddress)}
            onChange={setPayoutAddress}
            data={MASTERNODE_PAYOUT_RECIPIENT_COPY}
            ariaLabel={UPDATE_REGISTRAR_COPY.payoutSection}
            validate={addr => isValidDashAddress(addr, network ?? undefined)}
            ownOptions={addressOptions}
            ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
            ownOptionsLoading={addressesLoading}
            ownOptionsError={addressesError}
            onRetryOwnOptions={retryAddresses}
          />
        )}
      </div>

      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <div className={'flex items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_REGISTRAR_COPY.operatorSection}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={UPDATE_REGISTRAR_COPY.operatorSection}
            options={REGISTRAR_KEY_CHOICE_OPTIONS}
            value={operatorChoice}
            onChange={setOperatorChoice}
          />
        </div>
        {operatorChoice === RegistrarKeyChoiceKind.Keep && (
          <HighlightedIdentifier className={'min-w-0 text-xs!'}>{node.operatorPublicKey}</HighlightedIdentifier>
        )}
        {operatorChoice === RegistrarKeyChoiceKind.External && (
          <MasternodeFieldInput
            value={operatorPublicKey}
            onChange={setOperatorPublicKey}
            ariaLabel={UPDATE_REGISTRAR_COPY.operatorSection}
            placeholder={UPDATE_REGISTRAR_COPY.operatorPlaceholder}
            invalid={operatorPublicKey.trim() !== '' && !isValidBlsPublicKey(operatorPublicKey)}
          />
        )}
        {operatorChoice !== RegistrarKeyChoiceKind.Keep && (
          <Alert
            tone={AlertTone.Warning}
            icon={<InfoCircleIcon size={14} />}
            title={UPDATE_REGISTRAR_COPY.operatorBanWarningTitle}
            description={UPDATE_REGISTRAR_COPY.operatorBanWarning}
          />
        )}
      </div>

      <div className={`flex flex-col gap-2 ${SURFACE_SECTION}`}>
        <div className={'flex items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_REGISTRAR_COPY.votingSection}</Text>
          <SegmentedControl
            appearance={SegmentedControlAppearance.Pill}
            ariaLabel={UPDATE_REGISTRAR_COPY.votingSection}
            options={REGISTRAR_KEY_CHOICE_OPTIONS}
            value={votingChoice}
            onChange={setVotingChoice}
          />
        </div>
        {votingChoice === RegistrarKeyChoiceKind.Keep && (
          <HighlightedIdentifier className={'min-w-0 text-xs!'}>{node.votingAddress}</HighlightedIdentifier>
        )}
        {votingChoice === RegistrarKeyChoiceKind.External && (
          <RecipientInput
            compact
            value={votingAddress}
            valueBadge={badgeFor(votingAddress)}
            onChange={setVotingAddress}
            data={MASTERNODE_VOTING_RECIPIENT_COPY}
            ariaLabel={UPDATE_REGISTRAR_COPY.votingSection}
            validate={addr => isValidDashChangeAddress(addr, network ?? undefined)}
            ownOptions={addressOptions}
            ownOptionsHeading={MASTERNODE_YOUR_ADDRESSES_HEADING}
            ownOptionsLoading={addressesLoading}
            ownOptionsError={addressesError}
            onRetryOwnOptions={retryAddresses}
          />
        )}
      </div>

      {error != null && (
        <Text size={12} weight={'medium'} color={'red'} className={'px-1'}>{error}</Text>
      )}
    </div>
  )

  return (
    <SignedActionModal<MasternodeUpdateResult>
      open={open}
      onClose={onClose}
      title={UPDATE_REGISTRAR_COPY.title}
      description={UPDATE_REGISTRAR_COPY.description}
      edit={{
        content: editContent,
        continueLabel: UPDATE_REGISTRAR_COPY.review,
        canContinue: dto != null,
      }}
      summary={
        dto && (
          <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{REGISTER_MASTERNODE_COPY.proTxHashLabel}</Text>
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{node.proTxHash}</HighlightedIdentifier>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_REGISTRAR_COPY.payoutSection}</Text>
              <HighlightedIdentifier className={'min-w-0 text-xs!'}>{dto.payoutAddress ?? node.payeeAddress ?? ''}</HighlightedIdentifier>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_REGISTRAR_COPY.operatorSection}</Text>
              <Text size={12} weight={'extrabold'} color={'brand'}>
                {REGISTRAR_KEY_CHOICE_OPTIONS.find(o => o.value === dto.operator.kind)?.label ?? dto.operator.kind}
              </Text>
            </div>
            <div className={'flex items-center justify-between gap-4'}>
              <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{UPDATE_REGISTRAR_COPY.votingSection}</Text>
              <Text size={12} weight={'extrabold'} color={'brand'}>
                {REGISTRAR_KEY_CHOICE_OPTIONS.find(o => o.value === dto.voting.kind)?.label ?? dto.voting.kind}
              </Text>
            </div>
          </div>
        )
      }
      confirmLabel={UPDATE_REGISTRAR_COPY.confirm}
      confirmDisabled={dto == null}
      inlineErrors
      pendingLabel={UPDATE_REGISTRAR_COPY.pending}
      run={run}
      renderDone={result => ({
        headline: UPDATE_REGISTRAR_COPY.doneHeadline,
        details: [
          { label: REGISTER_MASTERNODE_COPY.networkFee, value: `${davToDash(result.fee)} ${DASH_UNIT}` },
          { label: REGISTER_MASTERNODE_COPY.peersAcked, value: String(result.peersAcked) },
        ],
        hash: {
          value: result.txid,
          label: UPDATE_REGISTRAR_COPY.txidLabel,
          explorerUrl: network == null ? null : transactionUrl(result.txid, network),
        },
      })}
    />
  )
}
