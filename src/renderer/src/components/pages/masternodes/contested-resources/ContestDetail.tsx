import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, CircleProcessIcon, HighlightedIdentifier, LockIcon, Text } from '@renderer/components/dash-ui-kit-extended'
import DashboardHeading from '@renderer/components/pages/dashboard/DashboardHeading'
import CustomBadge from '@renderer/components/ui/CustomBadge'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import NoResults from '@renderer/components/ui/NoResults'
import PageHeader from '@renderer/components/ui/PageHeader'
import RetryButton from '@renderer/components/ui/RetryButton'
import SearchField from '@renderer/components/ui/SearchField'
import ListSkeleton from '@renderer/components/ui/Skeleton'
import StatusPill from '@renderer/components/ui/StatusPill'
import { DASHPAY_PARAMS, DASHPAY_ROUTES } from '@renderer/constants/dashPay'
import { CONTEST_DETAIL_COPY, CONTEST_LIST_SEPARATOR, CONTEST_ROW_COPY, CONTEST_STATUS_PILLS, CONTEST_VOTE_FORMS, CONTENDER_SEARCH_MIN } from '@renderer/constants/nameContests'
import { PAGE_HEADERS } from '@renderer/constants/pageHeaders'
import { CHIP_ACTION, ICON_CHIP, SURFACE_PANEL } from '@renderer/constants/surfaces'
import { DashPayTab } from '@renderer/enums/DashPay'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { ContestStatus } from '@renderer/enums/Masternodes'
import { NoResultsTone } from '@renderer/enums/NoResultsTone'
import { useNameContests } from '@renderer/hooks/useNameContests'
import type { ContestDetailProps } from '@renderer/types/MasternodeScreens'
import { countLabel } from '@renderer/utils/countLabel'
import { formatTimestamp } from '@renderer/utils/date'
import { fullDpnsName } from '@renderer/utils/dpnsLabel'
import { contestStatus, totalContestVotes, voteShare } from '@renderer/utils/nameContests'
import { withParams } from '@renderer/utils/searchParams'
import { formatTimeLeft } from '@renderer/utils/timeLeft'
import ContenderOption from './ContenderOption'

export default function ContestDetail({ walletId, now, normalizedLabel, onBack }: ContestDetailProps): React.JSX.Element {
  const { contests, loading, err, retry } = useNameContests(walletId)
  const [query, setQuery] = useState('')
  const contest = contests.find(candidate => candidate.normalizedLabel === normalizedLabel)

  if (contest == null) {
    return (
      <>
        <PageHeader title={fullDpnsName(normalizedLabel)} onBack={onBack} backLabel={PAGE_HEADERS.nameContest.back} />
        {loading ? <ListSkeleton rows={4} rowClassName={'h-[3.75rem] rounded-[.875rem]'} /> : (
          <div className={SURFACE_PANEL}>
            <NoResults
              tone={NoResultsTone.Error}
              noResults={err ?? CONTEST_DETAIL_COPY.unknown}
              action={err == null
                ? <Button type={'button'} size={'compact'} colorScheme={'primary-light'} onClick={onBack}>{CONTEST_DETAIL_COPY.backShort}</Button>
                : <RetryButton onRetry={retry} />}
            />
          </div>
        )}
      </>
    )
  }

  const { status, waitingForOutcome } = contestStatus(contest, now)
  const pill = CONTEST_STATUS_PILLS[status]
  const total = totalContestVotes(contest)
  const contenders = [...contest.contenders].sort((a, b) => b.votes - a.votes)
  const searchable = contenders.length > CONTENDER_SEARCH_MIN
  const visible = searchable ? contenders.filter(({ identifier }) => identifier.includes(query.trim())) : contenders
  const lead = Math.max(contenders[0]?.votes ?? 0, contest.votesLock ?? 0, contest.votesAbstain ?? 0)
  const endsAt = contest.voteEndsAt

  return (
    <div className={'flex flex-col'}>
      <PageHeader
        onBack={onBack}
        backLabel={PAGE_HEADERS.nameContest.back}
        title={fullDpnsName(contest.label)}
        titleAddon={<StatusPill tone={pill.tone}>{waitingForOutcome ? CONTEST_ROW_COPY.pending : pill.label}</StatusPill>}
        subtitle={endsAt == null ? undefined : formatTimestamp(new Date(endsAt))}
        actions={status === ContestStatus.Open && !waitingForOutcome && endsAt != null && (
          <Text size={12} weight={'medium'} color={'brand'} opacity={50}>
            {`${CONTEST_DETAIL_COPY.endsIn} `}
            <strong className={'tabular-nums'}>{formatTimeLeft(endsAt, now)}</strong>
          </Text>
        )}
      />
      <section className={`flex min-w-0 flex-col gap-3 ${SURFACE_PANEL}`}>
        {contest.voteWinner != null && (
          <div className={'flex flex-wrap items-center gap-3 px-1'}>
            <Text size={12} weight={'medium'} color={'brand'} opacity={50}>{CONTEST_DETAIL_COPY.winner}</Text>
            <HighlightedIdentifier className={'min-w-0'}>{contest.voteWinner}</HighlightedIdentifier>
          </div>
        )}
        <div className={'flex items-center justify-between gap-3 px-1'}>
          <DashboardHeading>{`${CONTEST_DETAIL_COPY.contenders}${CONTEST_LIST_SEPARATOR}${contenders.length}`}</DashboardHeading>
          <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>{countLabel(total, CONTEST_VOTE_FORMS)}</Text>
        </div>
        {searchable && (
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={CONTEST_DETAIL_COPY.searchContenders}
            ariaLabel={CONTEST_DETAIL_COPY.searchContenders}
          />
        )}
        <div className={'flex flex-col gap-1.5'}>
          {visible.map(({ identifier, votes }) => {
            const ours = contest.walletIdentifiers.includes(identifier)
            return (
              <Fragment key={identifier}>
                <ContenderOption
                  icon={<IdentityAvatar identifier={identifier} size={IdentityAvatarSize.Sm} />}
                  title={<HighlightedIdentifier className={'min-w-0'}>{identifier}</HighlightedIdentifier>}
                  badge={(
                    <>
                      {status === ContestStatus.Open && votes > 0 && votes === lead && (
                        <CustomBadge variant={'muted'} text={CONTEST_DETAIL_COPY.leading} className={'shrink-0'} />
                      )}
                      {ours && <CustomBadge variant={'accent'} text={CONTEST_DETAIL_COPY.yourIdentity} className={'shrink-0'} />}
                    </>
                  )}
                  votes={votes}
                  share={voteShare(votes, total)}
                />
                {ours && (
                  <Link
                    to={`${DASHPAY_ROUTES.root}?${withParams('', { [DASHPAY_PARAMS.tab]: DashPayTab.Usernames, [DASHPAY_PARAMS.identity]: identifier })}`}
                    className={`${CHIP_ACTION} ml-[3.75rem] self-start font-medium`}
                  >
                    {CONTEST_DETAIL_COPY.openInDashPay}
                  </Link>
                )}
              </Fragment>
            )
          })}
          {visible.length === 0 && (
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'py-4 text-center'}>
              {contenders.length === 0 ? CONTEST_DETAIL_COPY.noContenders : CONTEST_DETAIL_COPY.noContenderMatch}
            </Text>
          )}
          {(contest.votesLock != null || contest.votesAbstain != null) && (
            <Text size={12} weight={'medium'} color={'brand'} opacity={50} className={'px-1 pt-3'}>{CONTEST_DETAIL_COPY.otherChoices}</Text>
          )}
          {contest.votesLock != null && (
            <ContenderOption
              icon={<span className={ICON_CHIP}><LockIcon size={14} color={'currentColor'} /></span>}
              title={CONTEST_DETAIL_COPY.lock}
              votes={contest.votesLock}
              share={voteShare(contest.votesLock, total)}
            />
          )}
          {contest.votesAbstain != null && (
            <ContenderOption
              icon={<span className={ICON_CHIP}><CircleProcessIcon size={14} color={'currentColor'} /></span>}
              title={CONTEST_DETAIL_COPY.abstain}
              votes={contest.votesAbstain}
              share={voteShare(contest.votesAbstain, total)}
            />
          )}
        </div>
      </section>
    </div>
  )
}
