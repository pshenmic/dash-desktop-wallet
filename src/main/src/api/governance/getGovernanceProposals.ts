import { IpcMainInvokeEvent } from 'electron/utility'
import { GovernanceService } from '../../services/core/GovernanceService'
import { Proposal } from '../../types/Governance'

export class GetGovernanceProposalsHandler {
  private governance: GovernanceService

  constructor(governance: GovernanceService) {
    this.governance = governance
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<Proposal[] | null> => {
    return this.governance.getProposals(walletId)
  }
}
