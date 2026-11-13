import { IpcMainInvokeEvent } from 'electron/utility'
import { PaymentRequestService } from '../../services/wallet/PaymentRequestService'

export class CreatePaymentRequestHandler {
  private paymentRequestService: PaymentRequestService

  constructor(paymentRequestService: PaymentRequestService) {
    this.paymentRequestService = paymentRequestService
  }

  handle = async (_event: IpcMainInvokeEvent, walletId: string, address: string, amountDuffs: bigint | null, label: string | null, message: string | null): Promise<void> => {
    return this.paymentRequestService.createRequest(walletId, address, amountDuffs, label, message)
  }
}
