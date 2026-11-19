import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { MasternodeRegistration, MasternodeRegistrationPreview } from '../../types/Masternode'

export class PreviewMasternodeRegistrationHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, registration: MasternodeRegistration): Promise<MasternodeRegistrationPreview> => {
    return this.masternodes.previewRegistration(walletId, registration)
  }
}
