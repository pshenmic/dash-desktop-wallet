import { IpcMainInvokeEvent } from 'electron/utility'
import { GovernanceService } from '../../services/core/GovernanceService'
import { ProposalTally } from '../../types/Governance'

export class GetProposalTallyHandler {
  private governance: GovernanceService

  constructor(governance: GovernanceService) {
    this.governance = governance
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, proposalHash: string): Promise<ProposalTally | null> => {
    return this.governance.getProposalTally(walletId, proposalHash)
  }
}
