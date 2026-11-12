import { IpcMainInvokeEvent } from 'electron/utility'
import { PlatformAddressService } from '../../services/platform/PlatformAddressService'

export class SetPlatformAddressLabelHandler {
  private platformAddressService: PlatformAddressService

  constructor(platformAddressService: PlatformAddressService) {
    this.platformAddressService = platformAddressService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, address: string, label: string): Promise<void> => {
    return this.platformAddressService.setAddressLabel(walletId, address, label)
  }
}
