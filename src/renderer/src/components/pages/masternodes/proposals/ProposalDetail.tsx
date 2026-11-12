import { useEffect, useState } from 'react'
import {
  Button,
  CheckIcon,
  CircleProcessIcon,
  CrossIcon,
  ExternalLinkIcon,
  HighlightedIdentifier,
  KeyIcon,
  Text,
} from '@renderer/components/dash-ui-kit-extended'
import {
  BoxIcon,
  CalendarIconHighlighted,
  DocumentIcon,
  WalletIcon,
} from '@renderer/components/dash-ui-kit-extended/icons'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import ContenderOption from '@renderer/components/pages/masternodes/contested-resources/ContenderOption'
import DetailToken from '@renderer/components/pages/transactions/TransactionDetailToken'
import CopyButton from '@renderer/components/ui/CopyButton'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import StatusPill from '@renderer/components/ui/StatusPill'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  PROPOSAL_DETAIL_COPY,
  PROPOSAL_STATUS_PILLS,
} from '@renderer/constants/governanceProposals'
import { NODE_DETAIL_ICON_CLASS, NODE_DETAIL_ROW_CLASS } from '@renderer/constants/masternodeNodes'
import { CONTEST_VOTE_FORMS } from '@renderer/constants/nameContests'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { ICON_CHIP, SURFACE_PANEL } from '@renderer/constants/surfaces'
import { TRANSACTION_DETAIL_CARD_CLASS } from '@renderer/constants/transactionsPage'
import { ProposalStatus } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import {
  refreshProposalTally,
  useGovernanceProposals,
  useProposalTally,
} from '@renderer/hooks/useGovernanceProposals'
import type { ProposalDetailProps } from '@renderer/types/MasternodeScreens'
import { davToDash } from '@renderer/utils/balance'
import { countLabel } from '@renderer/utils/countLabel'
import { formatTimestamp } from '@renderer/utils/date'
import {
  netProposalVotes,
  proposalEndMs,
  proposalStartMs,
  proposalStatus,
  safeExternalProposalUrl,
  totalProposalVotes,
} from '@renderer/utils/governanceProposals'
import { voteShare } from '@renderer/utils/nameContests'
import { formatTimeLeft } from '@renderer/utils/timeLeft'
import VoteProposalModal from './VoteProposalModal'

export default function ProposalDetail({
  walletId,
  now,
  proposalHash,
  onBack,
}: ProposalDetailProps): React.JSX.Element {
  const { proposals, loading, err, retry } = useGovernanceProposals(walletId)
  const { tally, loading: tallyLoading } = useProposalTally(walletId, proposalHash)
  const [voteOpen, setVoteOpen] = useState(false)
  const proposal = proposals.find(candidate => candidate.hash === proposalHash)

  useEffect(() => {
    void refreshProposalTally(walletId, proposalHash)
  }, [walletId, proposalHash])

  if (proposal == null) {
    return (
      <div className={'pt-2'}>
        <PageHeader title={proposalHash.slice(0, 12)} onBack={onBack} backLabel={PAGE_HEADERS.proposalDetail.back} />
        {loading ? (
          <ListSkeleton rows={4} rowClassName={'h-[3.75rem] rounded-[.875rem]'} />
        ) : (
          <div className={SURFACE_PANEL}>
            <NoResults
              tone={NoResultsTone.Error}
              noResults={err ?? PROPOSAL_DETAIL_COPY.unknown}
              action={err == null
                ? <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={onBack}>{PROPOSAL_DETAIL_COPY.backShort}</Button>
                : <RetryButton onRetry={retry} />}
            />
          </div>
        )}
      </div>
    )
  }

  const status = proposalStatus(proposal, now)
  const pill = PROPOSAL_STATUS_PILLS[status]
  const startMs = proposalStartMs(proposal)
  const endMs = proposalEndMs(proposal)
  const safeUrl = safeExternalProposalUrl(proposal.url)
  const totalVotes = totalProposalVotes(tally)
  const netVotes = netProposalVotes(tally)
  const yesVotes = tally?.yes ?? 0
  const noVotes = tally?.no ?? 0
  const abstainVotes = tally?.abstain ?? 0

  return (
    <div className={'flex flex-col gap-4'}>
      <PageHeader
        onBack={onBack}
        backLabel={PAGE_HEADERS.proposalDetail.back}
        title={proposal.name}
        titleAddon={<StatusPill tone={pill.tone}>{pill.label}</StatusPill>}
        subtitle={
          status === ProposalStatus.Active
            ? `${PROPOSAL_DETAIL_COPY.endsIn} ${formatTimeLeft(endMs, now)}`
            : status === ProposalStatus.Upcoming
              ? `${PROPOSAL_DETAIL_COPY.startsIn} ${formatTimeLeft(startMs, now)}`
              : formatTimestamp(new Date(endMs))
        }
        actions={(
          <div className={'flex flex-wrap items-center gap-2'}>
            {safeUrl != null && (
              <Button
                type={'button'}
                size={'compact'}
                colorScheme={'primary-light'}
                onClick={() => { window.open(safeUrl, '_blank', 'noopener,noreferrer') }}
                className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
              >
                <ExternalLinkIcon size={12} color={'currentColor'} />
                {PROPOSAL_DETAIL_COPY.openUrl}
              </Button>
            )}
            <Button
              type={'button'}
              size={'compact'}
              colorScheme={'primary'}
              onClick={() => setVoteOpen(true)}
              className={'inline-flex items-center gap-1.5 rounded-[.75rem]'}
            >
              <KeyIcon size={12} color={'currentColor'} />
              {PROPOSAL_DETAIL_COPY.voteButton}
            </Button>
          </div>
        )}
      />

      <section className={`flex min-w-0 flex-col gap-3 ${SURFACE_PANEL}`}>
        <div className={'flex items-center justify-between gap-3 px-1'}>
          <DashboardHeading>{PROPOSAL_DETAIL_COPY.tallyHeading}</DashboardHeading>
          <div className={'flex items-center gap-3'}>
            <Text size={12} weight={'bold'} color={'brand'} className={'tabular-nums'}>
              {`${PROPOSAL_DETAIL_COPY.netScore}: ${netVotes >= 0 ? `+${netVotes}` : netVotes}`}
            </Text>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>
              {tallyLoading && tally == null ? PROPOSAL_DETAIL_COPY.tallyLoading : countLabel(totalVotes, CONTEST_VOTE_FORMS)}
            </Text>
          </div>
        </div>
        <div className={'flex flex-col gap-1.5'}>
          <ContenderOption
            icon={<span className={ICON_CHIP}><CheckIcon size={14} color={'currentColor'} /></span>}
            title={PROPOSAL_DETAIL_COPY.yes}
            votes={yesVotes}
            share={voteShare(yesVotes, totalVotes)}
          />
          <ContenderOption
            icon={<span className={ICON_CHIP}><CrossIcon size={14} color={'currentColor'} /></span>}
            title={PROPOSAL_DETAIL_COPY.no}
            votes={noVotes}
            share={voteShare(noVotes, totalVotes)}
          />
          <ContenderOption
            icon={<span className={ICON_CHIP}><CircleProcessIcon size={14} color={'currentColor'} /></span>}
            title={PROPOSAL_DETAIL_COPY.abstain}
            votes={abstainVotes}
            share={voteShare(abstainVotes, totalVotes)}
          />
        </div>
      </section>

      <div className={TRANSACTION_DETAIL_CARD_CLASS}>
        <div className={'flex flex-col gap-3'}>
          <div className={NODE_DETAIL_ROW_CLASS}>
            <span className={ICON_CHIP}><DocumentIcon size={14} color={'currentColor'} /></span>
            <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{PROPOSAL_DETAIL_COPY.proposalHash}</Text>
            <HighlightedIdentifier className={'min-w-0 font-medium!'}>{proposal.hash}</HighlightedIdentifier>
            <CopyButton text={proposal.hash} className={'shrink-0'} />
          </div>
          <div className={NODE_DETAIL_ROW_CLASS}>
            <span className={ICON_CHIP}><WalletIcon size={14} color={'currentColor'} /></span>
            <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{PROPOSAL_DETAIL_COPY.paymentAddress}</Text>
            <HighlightedIdentifier className={'min-w-0 font-medium!'}>{proposal.paymentAddress}</HighlightedIdentifier>
            <CopyButton text={proposal.paymentAddress} className={'shrink-0'} />
          </div>
          <div className={NODE_DETAIL_ROW_CLASS}>
            <span className={ICON_CHIP}><BoxIcon size={14} color={'currentColor'} /></span>
            <Text size={14} weight={'medium'} color={'brand'} className={'shrink-0'}>{PROPOSAL_DETAIL_COPY.collateralHash}</Text>
            <HighlightedIdentifier className={'min-w-0 font-medium!'}>{proposal.collateralHash}</HighlightedIdentifier>
            <CopyButton text={proposal.collateralHash} className={'shrink-0'} />
          </div>
        </div>

        <div className={'grid grid-cols-1 lg:grid-cols-2 gap-3'}>
          <DetailToken
            icon={<WalletIcon size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
            label={PROPOSAL_DETAIL_COPY.paymentAmount}
            value={(
              <Text size={14} weight={'extrabold'} color={'brand'} className={'tabular-nums'}>
                {`${davToDash(proposal.paymentDuffs)} ${DASH_UNIT}`}
              </Text>
            )}
          />
          <DetailToken
            icon={<CalendarIconHighlighted size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
            label={PROPOSAL_DETAIL_COPY.createdAt}
            value={(
              <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                {formatTimestamp(new Date(proposal.createdAt * 1000))}
              </Text>
            )}
          />
          <DetailToken
            icon={<CalendarIconHighlighted size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
            label={PROPOSAL_DETAIL_COPY.startDate}
            value={(
              <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                {formatTimestamp(new Date(startMs))}
              </Text>
            )}
          />
          <DetailToken
            icon={<CalendarIconHighlighted size={14} color={'currentColor'} className={NODE_DETAIL_ICON_CLASS} />}
            label={PROPOSAL_DETAIL_COPY.endDate}
            value={(
              <Text size={14} weight={'medium'} color={'brand'} className={'tabular-nums'}>
                {formatTimestamp(new Date(endMs))}
              </Text>
            )}
          />
        </div>
      </div>

      {voteOpen && (
        <VoteProposalModal
          walletId={walletId}
          proposal={proposal}
          open={voteOpen}
          onClose={() => setVoteOpen(false)}
        />
      )}
    </div>
  )
}
