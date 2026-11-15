import {IpcMainInvokeEvent} from 'electron/utility'
import {parseNetwork} from '../utils/parseNetwork'
import {ApplicationService} from '../services/app/ApplicationService'

export class GetDnsSeedsHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent, network: unknown): Promise<string[]> => {
    const networkName = parseNetwork('getDnsSeeds', network)

    return [...this.applicationService.preferences.network[networkName].dnsSeeds]
  }
}
