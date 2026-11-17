import { IpcMainInvokeEvent } from 'electron/utility'
import { WalletCredentialsService } from '../../services/wallet/WalletCredentialsService'
import { AddressKeyInfo } from '../../types/Address'

export class ExportKeyByAddressHandler {
  private credentials: WalletCredentialsService

  constructor(credentials: WalletCredentialsService) {
    this.credentials = credentials
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, address: string, password: string): Promise<AddressKeyInfo> => {
    return this.credentials.exportKeyByAddress(walletId, address, password)
  }
}
