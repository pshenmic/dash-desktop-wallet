import {IpcMainInvokeEvent} from 'electron/utility'
import {MasternodeService} from '../../services/core/MasternodeService'
import {SharedRegistrationBroadcastResult} from '../../types/Masternode'

export class BroadcastSharedMasternodeRegistrationHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, txHex: string): Promise<SharedRegistrationBroadcastResult> => {
    return this.masternodes.broadcastSharedRegistration(walletId, txHex)
  }
}
