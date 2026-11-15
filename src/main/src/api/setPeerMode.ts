import {IpcMainInvokeEvent} from 'electron/utility'
import {parsePeerMode} from '../utils/parseNetwork'
import {ApplicationService} from '../services/app/ApplicationService'
import {WalletSyncService} from '../services/core/WalletSyncService'

export class SetPeerModeHandler {
  private applicationService: ApplicationService
  private walletSyncService: WalletSyncService

  constructor(applicationService: ApplicationService, walletSyncService: WalletSyncService) {
    this.applicationService = applicationService
    this.walletSyncService = walletSyncService
  }

  // Applies to every network: the peers are per network, the kind of discovery
  // is not. 'static' is rejected while no network has a peer to dial — see
  // NetworkPreferencesSchema.
  handle = async (_event: IpcMainInvokeEvent, mode: unknown): Promise<void> => {
    const parsedMode = parsePeerMode('setPeerMode', mode)

    const preferences = this.applicationService.preferences
    await preferences.apply({
      ...preferences,
      network: {...preferences.network, mode: parsedMode},
    })

    await this.walletSyncService.reloadPeerPreferences()
  }
}
