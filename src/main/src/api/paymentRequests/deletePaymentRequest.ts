import { IpcMainInvokeEvent } from 'electron/utility'
import { PaymentRequestService } from '../../services/wallet/PaymentRequestService'

export class DeletePaymentRequestHandler {
  private paymentRequestService: PaymentRequestService

  constructor(paymentRequestService: PaymentRequestService) {
    this.paymentRequestService = paymentRequestService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, id: number): Promise<void> => {
    return this.paymentRequestService.deleteRequest(walletId, id)
  }
}
