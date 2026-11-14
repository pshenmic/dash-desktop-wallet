import {IpcMainInvokeEvent} from 'electron/utility'
import type {DapiUrlStatus} from '../../platform/types/messages'
import {parseNetwork} from '../utils/parseNetwork'
import {PlatformWorkerService} from '../services/platform/PlatformWorkerService'

export class GetActiveDapiUrlsHandler {
  private platformWorkerService: PlatformWorkerService

  constructor(platformWorkerService: PlatformWorkerService) {
    this.platformWorkerService = platformWorkerService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<DapiUrlStatus[]> => {
    const networkName = parseNetwork('getActiveDapiUrls', network)

    return this.platformWorkerService.request('activeDapiUrls', networkName, {})
  }
}
