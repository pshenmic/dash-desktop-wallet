import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletService } from '../../services/wallet/WalletService'

export class SetUtxoLockedHandler {
  private walletService: WalletService

  constructor(walletService: WalletService) {
    this.walletService = walletService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, txid: string, vout: number, locked: boolean): Promise<void> => {
    return this.walletService.setUtxoLocked(walletId, txid, vout, locked)
  }
}
