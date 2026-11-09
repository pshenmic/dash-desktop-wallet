import { IpcMainInvokeEvent } from 'electron/utility'
import { GovernanceService } from '../../services/core/GovernanceService'
import { VoteOutcome, VoteResult } from '../../types/Governance'

export class VoteProposalHandler {
  private governance: GovernanceService

  constructor(governance: GovernanceService) {
    this.governance = governance
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, proposalHash: string, outcome: VoteOutcome, proTxHashes: string[], password: string): Promise<VoteResult[]> => {
    return this.governance.vote(walletId, proposalHash, outcome, proTxHashes, password)
  }
}
