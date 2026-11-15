import { IpcMainInvokeEvent } from 'electron/utility'
import {ApplicationService} from "../services/app/ApplicationService";

export class SetFiatCurrencyHandler {
  private applicationService: ApplicationService

  constructor(applicationService: ApplicationService) {
    this.applicationService = applicationService
  }

  handle = async (_event: IpcMainInvokeEvent, currency: string): Promise<void> => {
    const preferences = this.applicationService.preferences

    await preferences.applyGeneral({currency})
  }
}
