import {IpcMainInvokeEvent} from 'electron/utility'
import {MasternodeService} from '../../services/core/MasternodeService'
import {SharedRegistrationFundingResult} from '../../types/Masternode'

export class SignSharedMasternodeRegistrationFundingHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, txHex: string, password: string): Promise<SharedRegistrationFundingResult> => {
    return this.masternodes.signSharedRegistrationFunding(walletId, txHex, password)
  }
}