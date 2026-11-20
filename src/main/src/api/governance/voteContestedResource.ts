import { IpcMainInvokeEvent } from 'electron/utility'
import { ContestedResourceService } from '../../services/platform/ContestedResourceService'
import { ContestedResourceVoteChoice, ContestedResourceVoteRequest } from '../../types/Governance'

export class VoteContestedResourceHandler {
  private contestedResources: ContestedResourceService

  constructor(contestedResources: ContestedResourceService) {
    this.contestedResources = contestedResources
  }

  handle = async (
    _event: IpcMainInvokeEvent,
    walletId: string,
    proTxHash: string,
    resource: ContestedResourceVoteRequest,
    choice: ContestedResourceVoteChoice,
    password: string,
  ): Promise<{stHash: string}> => {
    return this.contestedResources.vote(walletId, proTxHash, resource, choice, password)
  }
}