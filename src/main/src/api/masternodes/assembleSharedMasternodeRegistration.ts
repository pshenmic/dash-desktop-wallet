import {IpcMainInvokeEvent} from 'electron/utility'
import {MasternodeService} from '../../services/core/MasternodeService'
import {SharedRegistrationContribution, SharedRegistrationFinal} from '../../types/Masternode'

export class AssembleSharedMasternodeRegistrationHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    txHex: string,
    contributions: SharedRegistrationContribution[],
  ): Promise<SharedRegistrationFinal> => {
    return this.masternodes.assembleSharedRegistration(walletId, txHex, contributions)
  }
}
