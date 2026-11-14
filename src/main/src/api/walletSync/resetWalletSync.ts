import {IpcMainInvokeEvent} from 'electron/utility'
import {WalletSyncService} from '../../services/core/WalletSyncService'
import {parseNetwork} from '../../utils/parseNetwork'

export class ResetWalletSyncHandler {
  constructor(private readonly walletSyncService: WalletSyncService) {}

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<void> => {
    await this.walletSyncService.resetSync(parseNetwork('resetWalletSync', network))
  }
}