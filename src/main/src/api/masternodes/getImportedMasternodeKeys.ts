import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { ImportedMasternodeKey } from '../../types/Masternode'

export class GetImportedMasternodeKeysHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<ImportedMasternodeKey[]> => {
    return this.masternodes.getImportedKeys(walletId)
  }
}
