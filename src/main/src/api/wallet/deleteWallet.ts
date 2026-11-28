import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'
import { MasternodeService } from '../../services/core/MasternodeService'

export class DeleteWalletHandler {
  private walletService: WalletService
  private masternodes: MasternodeService

  constructor(walletService: WalletService, masternodes: MasternodeService) {
    this.walletService = walletService
    this.masternodes = masternodes
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<void> => {
    await this.walletService.deleteWallet(walletId)
    this.masternodes.forgetWallet(walletId)
  }
}
