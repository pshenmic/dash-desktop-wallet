import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'

export class SetAddressLockedHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, address: string, locked: boolean): Promise<void> => {
    return this.walletService.setAddressLocked(walletId, address, locked)
  }
}
