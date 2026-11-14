import { IpcMainInvokeEvent } from 'electron/utility'
import { GovernanceService } from '../../services/core/GovernanceService'

export class RefreshGovernanceHandler {
  private governance: GovernanceService

  constructor(governance: GovernanceService) {
    this.governance = governance
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, proposalHash?: string): Promise<void> => {
    return this.governance.refresh(walletId, proposalHash)
  }
}
