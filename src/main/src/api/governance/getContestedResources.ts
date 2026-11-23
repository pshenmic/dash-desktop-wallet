import { IpcMainInvokeEvent } from 'electron/utility'
import { ContestedResourceService } from '../../services/platform/ContestedResourceService'
import { ContestedResource } from '../../types/Governance'

export class GetContestedResourcesHandler {
  private contestedResources: ContestedResourceService

  constructor(contestedResources: ContestedResourceService) {
    this.contestedResources = contestedResources
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<ContestedResource[]> => {
    return this.contestedResources.getContestedResources(walletId)
  }
}