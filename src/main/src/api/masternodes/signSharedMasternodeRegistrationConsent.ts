import {IpcMainInvokeEvent} from 'electron/utility'
import {MasternodeService} from '../../services/core/MasternodeService'
import {SharedRegistrationConsentResult} from '../../types/Masternode'

export class SignSharedMasternodeRegistrationConsentHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, txHex: string, password: string): Promise<SharedRegistrationConsentResult> => {
    return this.masternodes.signSharedRegistrationConsent(walletId, txHex, password)
  }
}