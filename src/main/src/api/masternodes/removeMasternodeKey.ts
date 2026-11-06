import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { ImportedMasternodeKey } from '../../types/Masternode'

export class RemoveMasternodeKeyHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, key: ImportedMasternodeKey): Promise<void> => {
    await this.masternodes.removeKey(walletId, key)
  }
}
