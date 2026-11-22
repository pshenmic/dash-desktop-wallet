import {IpcMainInvokeEvent} from 'electron/utility'
import {MasternodeService} from '../../services/core/MasternodeService'
import {SharedRegistrationJoined, SharedRegistrationSignature} from '../../types/Masternode'

export class CombineSharedMasternodeRegistrationHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    txHex: string,
    signatures: SharedRegistrationSignature[],
  ): Promise<SharedRegistrationJoined> => {
    return this.masternodes.combineSharedRegistration(walletId, txHex, signatures)
  }
}
