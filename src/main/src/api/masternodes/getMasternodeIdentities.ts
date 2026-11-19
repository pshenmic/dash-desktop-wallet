import { IpcMainInvokeEvent } from 'electron/utility'
import { IdentityService } from '../../services/platform/IdentityService'
import { MasternodeIdentityInfo } from '../../types/MasternodeIdentity'

export class GetMasternodeIdentitiesHandler {
  private identities: IdentityService

  constructor(identities: IdentityService) {
    this.identities = identities
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<MasternodeIdentityInfo[]> => {
    return this.identities.getMasternodeIdentities(walletId)
  }
}