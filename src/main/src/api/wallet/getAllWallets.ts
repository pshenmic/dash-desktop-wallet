import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletSummary } from '../../types/Wallet'
import { WalletService } from '../../services/wallet/WalletService'

export class GetAllWalletsHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent): Promise<WalletSummary[]> => {
    const wallets = await this.walletService.getAllWallets()
    return wallets.map(({walletId, network, label, selected}) => ({walletId, network, label, selected}))
  }
}
