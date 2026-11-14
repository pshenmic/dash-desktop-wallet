import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { MasternodeUpdateResult, RevocationReason } from '../../types/Masternode'

export class RevokeMasternodeHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, proTxHash: string, reason: RevocationReason, password: string): Promise<MasternodeUpdateResult> => {
    return this.masternodes.revoke(walletId, proTxHash, reason, password)
  }
}
