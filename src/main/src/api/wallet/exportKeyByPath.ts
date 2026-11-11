import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletCredentialsService } from '../../services/wallet/WalletCredentialsService'
import { AddressKeyInfo } from '../../types/Address'

export class ExportKeyByPathHandler {
  private credentials: WalletCredentialsService

  constructor(credentials: WalletCredentialsService) {
    this.credentials = credentials
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, path: string, password: string): Promise<AddressKeyInfo> => {
    return this.credentials.exportKeyByPath(walletId, path, password)
  }
}
