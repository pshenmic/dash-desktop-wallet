import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService } from '../../services/platform/ShieldedService'
import { ShieldedAddressEntry } from '../../types/ShieldedAddress'

export class AddShieldedAddressHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password: string): Promise<ShieldedAddressEntry[]> => {
    return this.shieldedService.addAddress(walletId, password)
  }
}
