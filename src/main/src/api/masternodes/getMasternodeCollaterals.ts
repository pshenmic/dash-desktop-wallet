import { IpcMainInvokeEvent } from 'electron/utility'
import { MasternodeService } from '../../services/core/MasternodeService'
import { OwnedCollateral } from '../../types/Masternode'

export class GetMasternodeCollateralsHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<OwnedCollateral[]> => {
    return this.masternodes.getCollaterals(walletId)
  }
}
