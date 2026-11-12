import { ChevronIcon, HighlightedIdentifier, Text } from '@renderer/components/dash-ui-kit-extended'
import { CopyIcon2, ExternalLinkIcon, WebIcon } from '@renderer/components/dash-ui-kit-extended/icons'
import ContextMenu from '@renderer/components/ui/ContextMenu'
import StatusPill from '@renderer/components/ui/StatusPill'
import { DASH_UNIT } from '@renderer/constants/balance'
import {
  PROPOSAL_STATUS_PILLS,
  PROPOSAL_TABLE_GRID,
  PROPOSALS_TAB_COPY,
} from '@renderer/constants/governanceProposals'
import { CONTEST_ROW_CHEVRON_CLASS } from '@renderer/constants/nameContests'
import { SECTION_TABLE_ROW } from '@renderer/constants/sectionTable'
import { ProposalStatus } from '@renderer/enums/Masternodes'
import { StatusPillTone } from '@renderer/enums/StatusPillTone'
import type { ProposalTableRowProps } from '@renderer/types/GovernanceProposals'
import type { ContextMenuItem } from '@renderer/types/ContextMenu'
import { davToDash } from '@renderer/utils/balance'
import { copyWithToast } from '@renderer/utils/clipboard'
import { formatTimestamp } from '@renderer/utils/date'
import {
  isProposalEndingSoon,
  proposalEndMs,
  proposalStartMs,
  proposalStatus,
  safeExternalProposalUrl,
} from '@renderer/utils/governanceProposals'
import { formatTimeLeft } from '@renderer/utils/timeLeft'

export default function ProposalTableRow({ proposal, now, network, onOpen }: ProposalTableRowProps): React.JSX.Element {
  const status = proposalStatus(proposal, now)
  const pill = PROPOSAL_STATUS_PILLS[status]
  const endingSoon = isProposalEndingSoon(proposal, now, network)
  const startMs = proposalStartMs(proposal)
  const endMs = proposalEndMs(proposal)
  const safeUrl = safeExternalProposalUrl(proposal.url)

  const menuItems: ContextMenuItem[] = [
    {
      id: 'open',
      label: PROPOSALS_TAB_COPY.open,
      icon: <ExternalLinkIcon size={10} color={'currentColor'} />,
      onSelect: () => onOpen(proposal.hash),
    },
    {
      id: 'copy',
      label: PROPOSALS_TAB_COPY.copyHash,
      icon: <CopyIcon2 size={10} color={'currentColor'} />,
      onSelect: () => copyWithToast(proposal.hash),
    },
  ]

  if (safeUrl != null) {
    menuItems.push({
      id: 'url',
      label: PROPOSALS_TAB_COPY.openUrl,
      icon: <WebIcon size={10} color={'currentColor'} />,
      onSelect: () => { window.open(safeUrl, '_blank', 'noopener,noreferrer') },
    })
  }

  let windowLabel: string
  if (status === ProposalStatus.Active) {
    windowLabel = `${PROPOSALS_TAB_COPY.endsIn} ${formatTimeLeft(endMs, now)}`
  } else if (status === ProposalStatus.Upcoming) {
    windowLabel = `${PROPOSALS_TAB_COPY.startsIn} ${formatTimeLeft(startMs, now)}`
  } else {
    windowLabel = formatTimestamp(new Date(endMs))
  }

  return (
    <ContextMenu title={PROPOSALS_TAB_COPY.menuTitle} items={menuItems}>
      <button type={'button'} onClick={() => onOpen(proposal.hash)} className={`${SECTION_TABLE_ROW} ${PROPOSAL_TABLE_GRID}`}>
        <div className={'flex min-w-0 flex-col gap-1'}>
          <Text size={14} weight={'medium'} color={'brand'} className={'min-w-0 truncate'}>{proposal.name}</Text>
          <HighlightedIdentifier className={'text-[.625rem]! opacity-70'}>{proposal.hash}</HighlightedIdentifier>
        </div>
        <Text size={14} weight={'bold'} color={'brand'} className={'min-w-0 truncate tabular-nums'}>
          {`${davToDash(proposal.paymentDuffs)} ${DASH_UNIT}`}
        </Text>
        <Text size={12} weight={'medium'} color={'brand'} opacity={70} className={'min-w-0 truncate tabular-nums'}>
          {windowLabel}
        </Text>
        <span className={'flex min-w-0 items-center'}>
          <StatusPill tone={endingSoon ? StatusPillTone.Warning : pill.tone}>
            {endingSoon ? formatTimeLeft(endMs, now) : pill.label}
          </StatusPill>
        </span>
        <ChevronIcon size={12} color={'currentColor'} className={CONTEST_ROW_CHEVRON_CLASS} />
      </button>
    </ContextMenu>
  )
}
