import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { MasternodeRegistration, MasternodeRegistrationResult } from '../../types/Masternode'

export class RegisterMasternodeHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, registration: MasternodeRegistration, password: string): Promise<MasternodeRegistrationResult> => {
    return this.masternodes.register(walletId, registration, password)
  }
}
