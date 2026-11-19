import type { MasternodeDto, Network, ProposalDto } from '@renderer/api/types'
import type { ProposalSegment } from '@renderer/enums/Masternodes'

export interface ProposalFilterOptions {
  query: string
  segment: ProposalSegment
  now: number
  network: Network | undefined
}

export interface ProposalTableRowProps {
  proposal: ProposalDto
  now: number
  network: Network | undefined
  onOpen: (hash: string) => void
}

export interface VoteProposalModalProps {
  walletId: string
  proposal: ProposalDto
  open: boolean
  onClose: () => void
}

export interface VotingNodeEligibility {
  eligible: MasternodeDto[]
  ineligible: Array<{ node: MasternodeDto; reason: string }>
}
