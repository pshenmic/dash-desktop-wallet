import {WalletDAO} from '../../database/WalletDAO'
import {ContestedResource} from '../../types/Governance'
import {requireWallet} from '../../utils/requireWallet'
import {PlatformWorkerService} from './PlatformWorkerService'

// Platform-side governance reads. A contested-resource vote is a Platform
// transition, so this cannot sit in core/GovernanceService, whose layer never
// reaches into platform/.
export class ContestedResourceService {
  private walletDAO: WalletDAO
  private platform: PlatformWorkerService

  constructor(walletDAO: WalletDAO, platform: PlatformWorkerService) {
    this.walletDAO = walletDAO
    this.platform = platform
  }

  // Every poll still open, across all contracts. Index values stay base64 of
  // their serialized form, which is what a vote transition carries.
  async getContestedResources(walletId: string): Promise<ContestedResource[]> {
    const {network} = await requireWallet(this.walletDAO, walletId)
    const {resources} = await this.platform.request('contestedResources', network, {})
    return resources
  }
}