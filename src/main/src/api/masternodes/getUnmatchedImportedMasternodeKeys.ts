import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { ImportedMasternodeKey } from '../../types/Masternode'

export class GetUnmatchedImportedMasternodeKeysHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<ImportedMasternodeKey[] | null> => {
    return this.masternodes.getUnmatchedImportedKeys(walletId)
  }
}
