import { ChevronIcon, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import IdentityAvatar from '@renderer/components/ui/IdentityAvatar'
import StatusPill from '@renderer/components/ui/StatusPill'
import {
  CONTEST_AVATAR_LIMIT,
  CONTEST_AVATAR_CLASS,
  CONTEST_ROW_CHEVRON_CLASS,
  CONTEST_ROW_COPY,
  CONTEST_STATUS_PILLS,
  CONTEST_TABLE_GRID,
  CONTEST_VOTE_FORMS,
} from '@renderer/constants/nameContests'
import { SECTION_TABLE_ROW } from '@renderer/constants/sectionTable'
import { IdentityAvatarSize } from '@renderer/enums/IdentityAvatarSize'
import { ContestStatus } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { ContestTableRowProps } from '@renderer/types/NameContests'
import { countLabel } from '@renderer/utils/countLabel'
import { fullDpnsName } from '@renderer/utils/dpnsLabel'
import { contestLeader, contestStatus, formatShare, isEndingSoon } from '@renderer/utils/nameContests'
import { formatTimeLeft } from '@renderer/utils/timeLeft'
import ShareBar from './ShareBar'

export default function ContestTableRow({ contest, now, network, onOpen }: ContestTableRowProps): React.JSX.Element {
  const leader = contestLeader(contest)
  const avatars = contest.contenders.slice(0, CONTEST_AVATAR_LIMIT)
  const extra = contest.contenders.length - avatars.length
  const { status, waitingForOutcome } = contestStatus(contest, now)
  const pill = CONTEST_STATUS_PILLS[status]
  const endsAt = contest.voteEndsAt
  const showCountdown = status === ContestStatus.Open && !waitingForOutcome && endsAt != null

  return (
    <button type={'button'} onClick={() => onOpen(contest.normalizedLabel)} className={`${SECTION_TABLE_ROW} ${CONTEST_TABLE_GRID}`}>
      <Text size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{fullDpnsName(contest.label)}</Text>
      <span className={'flex items-center'}>
        {avatars.map(contender => (
          <span key={contender.identifier} className={CONTEST_AVATAR_CLASS}>
            <IdentityAvatar identifier={contender.identifier} size={IdentityAvatarSize.Xs} />
          </span>
        ))}
        {extra > 0 && <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'ml-1'}>{`+${extra}`}</Text>}
        {avatars.length === 0 && <Text size={12} opacity={50}>{CONTEST_ROW_COPY.none}</Text>}
      </span>
      <div className={'flex min-w-0 flex-col gap-1'}>
        {leader.label == null ? <Text size={12} opacity={50}>{CONTEST_ROW_COPY.none}</Text> : (
          <>
            <HighlightedIdentifier className={'min-w-0 text-xs!'}>{leader.label}</HighlightedIdentifier>
            <span className={'flex flex-wrap items-center gap-2'}>
              <ShareBar share={leader.share} className={'w-16 shrink-0'} />
              <Text size={10} weight={'medium'} color={'brand'} opacity={50} className={'tabular-nums'}>
                {`${countLabel(leader.votes, CONTEST_VOTE_FORMS)} · ${formatShare(leader.share)}`}
              </Text>
            </span>
          </>
        )}
      </div>
      <span className={'flex min-w-0 items-center'}>
        {showCountdown
          ? <StatusPill tone={isEndingSoon(contest, now, network) ? StatusPillTone.Warning : pill.tone}>{formatTimeLeft(endsAt, now)}</StatusPill>
          : <StatusPill tone={pill.tone}>{waitingForOutcome ? CONTEST_ROW_COPY.pending : pill.label}</StatusPill>}
      </span>
      <ChevronIcon size={12} color={'currentColor'} className={CONTEST_ROW_CHEVRON_CLASS} />
    </button>
  )
}
