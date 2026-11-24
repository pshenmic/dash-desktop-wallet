import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import { ListedUtxo } from '../../types/CoinSelection'

export class GetUtxosHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<ListedUtxo[]> => {
    return this.walletService.getUtxos(walletId)
  }
}
