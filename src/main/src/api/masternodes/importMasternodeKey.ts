import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { Masternode, MasternodeKeyChain } from '../../types/Masternode'

export class ImportMasternodeKeyHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, role: MasternodeKeyChain, privateKey: string): Promise<Masternode[] | null> => {
    return this.masternodes.importKey(walletId, role, privateKey)
  }
}
