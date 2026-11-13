import { IpcMainInvokeEvent } from 'electron/utility'
import { PaymentRequestService } from '../../services/wallet/PaymentRequestService'
import { PaymentRequest } from '../../types/PaymentRequest'

export class GetPaymentRequestsHandler {
  private paymentRequestService: PaymentRequestService

  constructor(paymentRequestService: PaymentRequestService) {
    this.paymentRequestService = paymentRequestService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string): Promise<PaymentRequest[]> => {
    return this.paymentRequestService.getRequests(walletId)
  }
}
