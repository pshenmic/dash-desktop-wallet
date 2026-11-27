import type {
  ContestedResourceVoteChoice,
  ContestedResourceVoteRequest,
  MasternodeDto,
} from '@renderer/api/types'
import type { NameContest } from '@renderer/types/NameContests'

export interface DaoPageProps {
  walletId: string
}

export interface MergedNameContest extends NameContest {
  voteRequest: ContestedResourceVoteRequest | null
}

export interface ContestVoteRunItem {
  proTxHash: string
  stHash: string | null
  error: string | null
}

export interface VoteContestModalProps {
  walletId: string
  contest: MergedNameContest
  open: boolean
  onClose: () => void
}

export interface PlatformVotingEligibility {
  eligible: MasternodeDto[]
  ineligible: Array<{ node: MasternodeDto; reason: string }>
}

export type ContestVoteOption = {
  key: string
  choice: ContestedResourceVoteChoice
  label: string
}
