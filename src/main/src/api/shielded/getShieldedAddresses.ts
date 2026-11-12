import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService } from '../../services/platform/ShieldedService'
import { ShieldedAddressEntry } from '../../types/ShieldedAddress'

export class GetShieldedAddressesHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, password?: string): Promise<ShieldedAddressEntry[] | null> => {
    return this.shieldedService.getAddresses(walletId, password)
  }
}
