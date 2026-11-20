import {IpcMainInvokeEvent} from 'electron/utility'
import {MasternodeService} from '../../services/core/MasternodeService'
import {SharedRegistrationPreview} from '../../types/Masternode'

export class PreviewSharedMasternodeRegistrationHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, txHex: string): Promise<SharedRegistrationPreview> => {
    return this.masternodes.previewSharedRegistration(walletId, txHex)
  }
}