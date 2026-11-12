import { IpcMainInvokeEvent } from 'electron/utility'
import { ShieldedService } from '../../services/platform/ShieldedService'

export class SetShieldedAddressLabelHandler {
  private shieldedService: ShieldedService

  constructor(shieldedService: ShieldedService) {
    this.shieldedService = shieldedService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, address: string, label: string): Promise<void> => {
    return this.shieldedService.setAddressLabel(walletId, address, label)
  }
}
