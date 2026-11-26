import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { MasternodeRegistrationResult } from '../../types/Masternode'

export class SignAndBroadcastMasternodeRegistrationHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, unsignedHex: string, password: string): Promise<MasternodeRegistrationResult> => {
    return this.masternodes.signAndBroadcastRegistration(walletId, unsignedHex, password)
  }
}
