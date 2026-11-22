import {IpcMainInvokeEvent} from 'electron/utility'
import {MasternodeService} from '../../services/core/MasternodeService'
import {SharedRegistrationDraft, SharedRegistrationPlan} from '../../types/Masternode'

export class BuildSharedMasternodeRegistrationHandler {
  private masternodes: MasternodeService

  constructor(masternodes: MasternodeService) {
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, draft: SharedRegistrationDraft): Promise<SharedRegistrationPlan> => {
    return this.masternodes.buildSharedRegistration(walletId, draft)
  }
}
