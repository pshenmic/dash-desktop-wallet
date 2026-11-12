import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { VoteOutcome, VoteResult } from '@renderer/api/types'
import { HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import CheckRow from '@renderer/components/ui/CheckRow'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import {
  VOTE_OUTCOME_LABELS,
  VOTE_OUTCOME_OPTIONS,
  VOTE_PROPOSAL_COPY,
} from '@renderer/constants/governanceProposals'
import { CHIP_ACTION, SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { SegmentedControlAppearance } from '@renderer/enums/SegmentedControlAppearance'
import { refreshProposalTally } from '@renderer/hooks/useGovernanceProposals'
import { useMasternodes } from '@renderer/hooks/useMasternodes'
import type { VoteProposalModalProps } from '@renderer/types/GovernanceProposals'
import {
  classifyVotingMasternodes,
  masternodeVoteWeight,
  totalSelectedVoteWeight,
} from '@renderer/utils/governanceProposals'
import { formatServiceAddress, masternodeType } from '@renderer/utils/masternodeNodes'

export default function VoteProposalModal({
  walletId,
  proposal,
  open,
  onClose,
}: VoteProposalModalProps): React.JSX.Element {
  const { nodes } = useMasternodes(walletId)
  const { eligible, ineligible } = useMemo(() => classifyVotingMasternodes(nodes), [nodes])
  const [outcome, setOutcome] = useState<VoteOutcome>('yes')
  const [excludedHashes, setExcludedHashes] = useState<ReadonlySet<string>>(() => new Set())

  const selectedHashes = useMemo(() => {
    const set = new Set<string>()
    for (const node of eligible) {
      if (!excludedHashes.has(node.proTxHash)) set.add(node.proTxHash)
    }
    return set
  }, [eligible, excludedHashes])

  const totalWeight = useMemo(
    () => totalSelectedVoteWeight(eligible, selectedHashes),
    [eligible, selectedHashes],
  )

  const toggleNode = (proTxHash: string): void => {
    setExcludedHashes(prev => {
      const next = new Set(prev)
      if (next.has(proTxHash)) next.delete(proTxHash)
      else next.add(proTxHash)
      return next
    })
  }

  const selectAll = (): void => setExcludedHashes(new Set())
  const clearAll = (): void => setExcludedHashes(new Set(eligible.map(n => n.proTxHash)))

  const run = async (password: string): Promise<VoteResult[]> => {
    const results = await API.voteProposal(
      walletId,
      proposal.hash,
      outcome,
      [...selectedHashes],
      password,
    )
    void refreshProposalTally(walletId, proposal.hash)
    return results
  }

  const editContent = (
    <div className={'mt-4 flex flex-col gap-3'}>
      <div className={'flex items-center justify-between gap-2'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_PROPOSAL_COPY.outcomeLabel}</Text>
        <SegmentedControl
          appearance={SegmentedControlAppearance.Pill}
          ariaLabel={VOTE_PROPOSAL_COPY.outcomeLabel}
          options={VOTE_OUTCOME_OPTIONS}
          value={outcome}
          onChange={setOutcome}
        />
      </div>

      <div className={'flex flex-col gap-2'}>
        <div className={'flex items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
            {`${VOTE_PROPOSAL_COPY.nodesLabel} (${selectedHashes.size}/${eligible.length})`}
          </Text>
          {eligible.length > 1 && (
            <div className={'flex items-center gap-1.5'}>
              <button type={'button'} onClick={selectAll} className={CHIP_ACTION}>{VOTE_PROPOSAL_COPY.selectAll}</button>
              <button type={'button'} onClick={clearAll} className={CHIP_ACTION}>{VOTE_PROPOSAL_COPY.clearSelection}</button>
            </div>
          )}
        </div>

        {eligible.length === 0 ? (
          <div className={SURFACE_SECTION}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_PROPOSAL_COPY.noEligibleNodes}</Text>
          </div>
        ) : (
          <div className={'flex max-h-48 flex-col gap-1.5 overflow-y-auto scrollbar-custom'}>
            {eligible.map(node => {
              const checked = selectedHashes.has(node.proTxHash)
              const weight = masternodeVoteWeight(node)
              return (
                <CheckRow
                  key={node.proTxHash}
                  label={formatServiceAddress(node.serviceAddress)}
                  checked={checked}
                  onChange={() => toggleNode(node.proTxHash)}
                >
                  <div className={'flex items-center justify-between gap-3'}>
                    <div className={'flex min-w-0 flex-col gap-0.5'}>
                      <div className={'flex items-center gap-2'}>
                        <Text size={12} weight={'bold'} color={'brand'} className={'truncate'}>{formatServiceAddress(node.serviceAddress)}</Text>
                        <CustomBadge {...masternodeType(node.type)} className={'shrink-0'} />
                      </div>
                      <HighlightedIdentifier className={'text-[.625rem]! opacity-70'}>{node.proTxHash}</HighlightedIdentifier>
                    </div>
                    <CustomBadge variant={'muted'} text={`${weight}${VOTE_PROPOSAL_COPY.weightSuffix}`} className={'shrink-0'} />
                  </div>
                </CheckRow>
              )
            })}
          </div>
        )}
      </div>

      {ineligible.length > 0 && (
        <div className={'flex flex-col gap-1.5'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_PROPOSAL_COPY.ineligibleSection}</Text>
          <div className={'flex max-h-28 flex-col gap-1 overflow-y-auto scrollbar-custom'}>
            {ineligible.map(({ node, reason }) => (
              <div key={node.proTxHash} className={`flex items-center justify-between gap-3 opacity-60 ${SURFACE_ROW}`}>
                <Text size={12} weight={'medium'} color={'brand'} className={'truncate'}>{formatServiceAddress(node.serviceAddress)}</Text>
                <Text size={10} weight={'medium'} color={'brand'} opacity={60} className={'shrink-0'}>{reason}</Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <SignedActionModal<VoteResult[]>
      open={open}
      onClose={onClose}
      title={VOTE_PROPOSAL_COPY.title}
      description={VOTE_PROPOSAL_COPY.description}
      edit={{
        content: editContent,
        continueLabel: VOTE_PROPOSAL_COPY.review,
        canContinue: selectedHashes.size > 0,
      }}
      summary={
        <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_PROPOSAL_COPY.proposalLabel}</Text>
            <Text size={12} weight={'extrabold'} color={'brand'} className={'truncate'}>{proposal.name}</Text>
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_PROPOSAL_COPY.outcomeLabel}</Text>
            <Text size={12} weight={'extrabold'} color={'brand'}>{VOTE_OUTCOME_LABELS[outcome]}</Text>
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_PROPOSAL_COPY.nodesVotedLabel}</Text>
            <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{String(selectedHashes.size)}</Text>
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_PROPOSAL_COPY.totalWeightLabel}</Text>
            <Text size={12} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>{String(totalWeight)}</Text>
          </div>
        </div>
      }
      confirmLabel={VOTE_PROPOSAL_COPY.confirm}
      confirmDisabled={selectedHashes.size === 0}
      pendingLabel={VOTE_PROPOSAL_COPY.pending}
      run={run}
      renderDone={results => {
        const allOk = results.every(r => r.accepted > 0)
        return {
          headline: allOk ? VOTE_PROPOSAL_COPY.doneHeadline : VOTE_PROPOSAL_COPY.partialHeadline,
          details: results.map(r => ({
            label: `${r.proTxHash.slice(0, 10)}…`,
            value: `${r.accepted}/${r.peers} ${VOTE_PROPOSAL_COPY.peersKeptSuffix}`,
          })),
        }
      }}
    />
  )
}
