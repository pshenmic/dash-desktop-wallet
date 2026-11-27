import { useMemo, useState } from 'react'
import { API } from '@renderer/api'
import type { ContestedResourceVoteChoice } from '@renderer/api/types'
import { CircleProcessIcon, HighlightedIdentifier, LockIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import SignedActionModal from '@renderer/components/modal/SignedActionModal'
import CheckRow from '@renderer/components/ui/CheckRow'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import { VOTE_CONTEST_COPY } from '@renderer/constants/dao'
import { VOTE_PROPOSAL_COPY } from '@renderer/constants/governanceProposals'
import { NODE_DETAIL_COPY } from '@renderer/constants/masternodeNodes'
import { CONTEST_DETAIL_COPY, CONTEST_VOTE_FORMS } from '@renderer/constants/nameContests'
import { CHIP_ACTION, ICON_CHIP, SURFACE_ROW, SURFACE_SECTION } from '@renderer/constants/surfaces'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { SignedActionDoneTone } from '@renderer/enums/SignedActionDoneTone'
import { refreshContestedResources } from '@renderer/hooks/useContestedResources'
import { refreshDashPay } from '@renderer/hooks/useDashPayRefresh'
import { useMasternodes } from '@renderer/hooks/useMasternodes'
import type { ContestVoteRunItem, VoteContestModalProps } from '@renderer/types/Dao'
import { classifyPlatformVotingMasternodes, contestVoteChoiceLabel } from '@renderer/utils/contestedResources'
import { countLabel } from '@renderer/utils/countLabel'
import { fullDpnsName } from '@renderer/utils/dpnsLabel'
import { getErrorMessage } from '@renderer/utils/error'
import { masternodeVoteWeight, totalSelectedVoteWeight } from '@renderer/utils/governanceProposals'
import { formatServiceAddress, isSharedNode, masternodeType } from '@renderer/utils/masternodeNodes'

function defaultVoteChoice(walletIdentifiers: string[], contenders: Array<{ identifier: string }>): ContestedResourceVoteChoice {
  const own = contenders.find(contender => walletIdentifiers.includes(contender.identifier))
  if (own != null) return { kind: 'towardsIdentity', identifier: own.identifier }
  if (contenders.length > 0) return { kind: 'towardsIdentity', identifier: contenders[0].identifier }
  return { kind: 'abstain' }
}

function isSameChoice(a: ContestedResourceVoteChoice, b: ContestedResourceVoteChoice): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'towardsIdentity' && b.kind === 'towardsIdentity') return a.identifier === b.identifier
  return true
}

export default function VoteContestModal({
  walletId,
  contest,
  open,
  onClose,
}: VoteContestModalProps): React.JSX.Element {
  const { nodes } = useMasternodes(walletId)
  const { eligible, ineligible } = useMemo(() => classifyPlatformVotingMasternodes(nodes), [nodes])
  const sortedContenders = useMemo(
    () => [...contest.contenders].sort((a, b) => b.votes - a.votes),
    [contest.contenders],
  )
  const [choice, setChoice] = useState<ContestedResourceVoteChoice>(
    () => defaultVoteChoice(contest.walletIdentifiers, sortedContenders),
  )
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
    setExcludedHashes((prev) => {
      const next = new Set(prev)
      if (next.has(proTxHash)) next.delete(proTxHash)
      else next.add(proTxHash)
      return next
    })
  }

  const selectAll = (): void => setExcludedHashes(new Set())
  const clearAll = (): void => setExcludedHashes(new Set(eligible.map(node => node.proTxHash)))

  const run = async (password: string): Promise<ContestVoteRunItem[]> => {
    const request = contest.voteRequest
    if (request == null) throw new Error('This contest does not expose a Platform vote target')
    const results: ContestVoteRunItem[] = []
    for (const proTxHash of selectedHashes) {
      try {
        const { stHash } = await API.voteContestedResource(walletId, proTxHash, request, choice, password)
        results.push({ proTxHash, stHash, error: null })
      } catch (err) {
        results.push({ proTxHash, stHash: null, error: getErrorMessage(err) })
      }
    }
    if (results.every(item => item.stHash == null)) {
      throw new Error(results[0]?.error ?? 'Failed to cast DPNS vote')
    }
    void refreshContestedResources(walletId)
    void refreshDashPay(walletId).catch(() => {})
    return results
  }

  const editContent = (
    <div className={'mt-4 flex flex-col gap-3'}>
      <div className={'flex flex-col gap-2'}>
        <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_CONTEST_COPY.choiceLabel}</Text>
        <div className={'flex max-h-44 flex-col gap-1.5 overflow-y-auto scrollbar-custom'}>
          {sortedContenders.map((contender) => {
            const optionChoice: ContestedResourceVoteChoice = { kind: 'towardsIdentity', identifier: contender.identifier }
            const selected = isSameChoice(choice, optionChoice)
            const ours = contest.walletIdentifiers.includes(contender.identifier)
            return (
              <CheckRow
                key={contender.identifier}
                label={contender.identifier}
                checked={selected}
                onChange={() => setChoice(optionChoice)}
              >
                <div className={'flex items-center justify-between gap-2'}>
                  <div className={'flex min-w-0 items-center gap-2'}>
                    <IdentityAvatar identifier={contender.identifier} size={IdentityAvatarSize.Xs} />
                    <HighlightedIdentifier className={'min-w-0 text-xs! font-medium!'}>{contender.identifier}</HighlightedIdentifier>
                    {ours && <CustomBadge variant={'accent'} size={'xs'} text={CONTEST_DETAIL_COPY.yourIdentity} className={'shrink-0'} />}
                  </div>
                  <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'shrink-0 tabular-nums'}>
                    {countLabel(contender.votes, CONTEST_VOTE_FORMS)}
                  </Text>
                </div>
              </CheckRow>
            )
          })}
          <CheckRow
            label={VOTE_CONTEST_COPY.lockOption}
            checked={choice.kind === 'lock'}
            onChange={() => setChoice({ kind: 'lock' })}
          >
            <div className={'flex items-center justify-between gap-2'}>
              <div className={'flex min-w-0 items-center gap-2'}>
                <span className={ICON_CHIP}><LockIcon size={12} color={'currentColor'} /></span>
                <div className={'flex min-w-0 flex-col'}>
                  <Text size={12} weight={'bold'} color={'brand'}>{VOTE_CONTEST_COPY.lockOption}</Text>
                  <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{VOTE_CONTEST_COPY.lockHint}</Text>
                </div>
              </div>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'shrink-0 tabular-nums'}>
                {countLabel(contest.votesLock ?? 0, CONTEST_VOTE_FORMS)}
              </Text>
            </div>
          </CheckRow>
          <CheckRow
            label={VOTE_CONTEST_COPY.abstainOption}
            checked={choice.kind === 'abstain'}
            onChange={() => setChoice({ kind: 'abstain' })}
          >
            <div className={'flex items-center justify-between gap-2'}>
              <div className={'flex min-w-0 items-center gap-2'}>
                <span className={ICON_CHIP}><CircleProcessIcon size={12} color={'currentColor'} /></span>
                <div className={'flex min-w-0 flex-col'}>
                  <Text size={12} weight={'bold'} color={'brand'}>{VOTE_CONTEST_COPY.abstainOption}</Text>
                  <Text size={10} weight={'medium'} color={'brand'} opacity={50}>{VOTE_CONTEST_COPY.abstainHint}</Text>
                </div>
              </div>
              <Text size={12} weight={'medium'} color={'brand'} opacity={60} className={'shrink-0 tabular-nums'}>
                {countLabel(contest.votesAbstain ?? 0, CONTEST_VOTE_FORMS)}
              </Text>
            </div>
          </CheckRow>
        </div>
      </div>

      <div className={'flex flex-col gap-2'}>
        <div className={'flex items-center justify-between gap-2'}>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
            {`${VOTE_CONTEST_COPY.nodesLabel} (${selectedHashes.size}/${eligible.length})`}
          </Text>
          {eligible.length > 1 && (
            <div className={'flex items-center gap-1.5'}>
              <button type={'button'} onClick={selectAll} className={CHIP_ACTION}>{VOTE_CONTEST_COPY.selectAll}</button>
              <button type={'button'} onClick={clearAll} className={CHIP_ACTION}>{VOTE_CONTEST_COPY.clearSelection}</button>
            </div>
          )}
        </div>

        {eligible.length === 0 ? (
          <div className={SURFACE_SECTION}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_CONTEST_COPY.noEligibleNodes}</Text>
          </div>
        ) : (
          <div className={'flex max-h-40 flex-col gap-1.5 overflow-y-auto scrollbar-custom'}>
            {eligible.map((node) => {
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
                        {isSharedNode(node) && <CustomBadge variant={'default'} text={NODE_DETAIL_COPY.sharedBadge} className={'shrink-0'} />}
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
          <div className={'flex max-h-24 flex-col gap-1 overflow-y-auto scrollbar-custom'}>
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
    <SignedActionModal<ContestVoteRunItem[]>
      open={open}
      onClose={onClose}
      title={VOTE_CONTEST_COPY.title}
      description={VOTE_CONTEST_COPY.description}
      edit={{
        content: editContent,
        continueLabel: VOTE_CONTEST_COPY.review,
        canContinue: selectedHashes.size > 0 && contest.voteRequest != null,
      }}
      summary={
        <div className={`flex flex-col gap-2.5 ${SURFACE_SECTION}`}>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_CONTEST_COPY.resourceLabel}</Text>
            <Text size={12} weight={'extrabold'} color={'brand'} className={'truncate'}>{fullDpnsName(contest.label)}</Text>
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_CONTEST_COPY.summaryChoiceLabel}</Text>
            {choice.kind === 'towardsIdentity' ? (
              <HighlightedIdentifier className={'min-w-0 text-xs! font-extrabold!'}>{choice.identifier}</HighlightedIdentifier>
            ) : (
              <Text size={12} weight={'extrabold'} color={'brand'}>{contestVoteChoiceLabel(choice)}</Text>
            )}
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_CONTEST_COPY.nodesVotedLabel}</Text>
            <Text size={12} weight={'medium'} color={'brand'} className={'tabular-nums'}>{String(selectedHashes.size)}</Text>
          </div>
          <div className={'flex items-center justify-between gap-4'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{VOTE_CONTEST_COPY.totalWeightLabel}</Text>
            <Text size={12} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>{String(totalWeight)}</Text>
          </div>
        </div>
      }
      confirmLabel={VOTE_CONTEST_COPY.confirm}
      confirmDisabled={selectedHashes.size === 0 || contest.voteRequest == null}
      inlineErrors
      pendingLabel={VOTE_CONTEST_COPY.pending}
      run={run}
      renderDone={(results) => {
        const allOk = results.every(item => item.stHash != null)
        return {
          tone: allOk ? SignedActionDoneTone.Success : SignedActionDoneTone.Partial,
          headline: allOk ? VOTE_CONTEST_COPY.doneHeadline : VOTE_CONTEST_COPY.partialHeadline,
          details: results.map(item => ({
            label: `${item.proTxHash.slice(0, 10)}…`,
            value: item.stHash != null ? `${VOTE_CONTEST_COPY.stHashAccepted} · ${item.stHash}` : (item.error ?? 'Failed'),
          })),
        }
      }}
    />
  )
}
