import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { MasternodeKeyChain, NetworkMasternode } from '../../types/Masternode'

export class CheckMasternodeKeyHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, role: MasternodeKeyChain, privateKey: string): Promise<NetworkMasternode[] | null> => {
    return this.masternodes.checkKey(walletId, role, privateKey)
  }
}
