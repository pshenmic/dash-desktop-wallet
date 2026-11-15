import {IpcMainInvokeEvent} from 'electron/utility'
import {parsePeerMode} from '../utils/parseNetwork'
import {ApplicationService} from '../services/app/ApplicationService'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

export class SetDapiModeHandler {
  private applicationService: ApplicationService
  private platformWorkerService: PlatformWorkerService

  constructor(applicationService: ApplicationService, platformWorkerService: PlatformWorkerService) {
    this.applicationService = applicationService
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, mode: unknown): Promise<void> => {
    const parsedMode = parsePeerMode('setDapiMode', mode)

    const preferences = this.applicationService.preferences
    await preferences.apply({
      ...preferences,
      network: {...preferences.network, dapi: {...preferences.network.dapi, mode: parsedMode}},
    })

    this.platformWorkerService.reloadDapi()
  }
}
