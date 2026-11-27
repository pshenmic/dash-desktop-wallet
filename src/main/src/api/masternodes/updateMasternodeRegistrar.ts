import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { MasternodeRegistrarUpdate, MasternodeUpdateResult } from '../../types/Masternode'

export class UpdateMasternodeRegistrarHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, proTxHash: string, update: MasternodeRegistrarUpdate, password: string): Promise<MasternodeUpdateResult> => {
    return this.masternodes.updateRegistrar(walletId, proTxHash, update, password)
  }
}
