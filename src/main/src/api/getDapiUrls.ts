import {IpcMainInvokeEvent} from 'electron/utility'
import {parseNetwork} from '../utils/parseNetwork'
import {ApplicationService} from '../services/app/ApplicationService'

export class GetDapiUrlsHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<string[]> => {
    const networkName = parseNetwork('getDapiUrls', network)

    return [...this.applicationService.preferences.network.dapi[networkName]]
  }
}
