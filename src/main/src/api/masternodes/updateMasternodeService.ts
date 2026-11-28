import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { MasternodeServiceUpdate, MasternodeUpdateResult } from '../../types/Masternode'

export class UpdateMasternodeServiceHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, proTxHash: string, update: MasternodeServiceUpdate, password: string): Promise<MasternodeUpdateResult> => {
    return this.masternodes.updateService(walletId, proTxHash, update, password)
  }
}
