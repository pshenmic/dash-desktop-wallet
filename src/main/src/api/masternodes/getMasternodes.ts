import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { Masternode } from '../../types/Masternode'

export class GetMasternodesHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<Masternode[] | null> => {
    return this.masternodes.getMasternodes(walletId)
  }
}
