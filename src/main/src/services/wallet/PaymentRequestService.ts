import {PaymentRequestDAO} from '../../database/PaymentRequestDAO'
import {PaymentRequest} from '../../types/PaymentRequest'

export class PaymentRequestService {
  private paymentRequestDAO: PaymentRequestDAO

  constructor(paymentRequestDAO: PaymentRequestDAO) {
    this.paymentRequestDAO = paymentRequestDAO
  }

  async createRequest(walletId: string, address: string, amountDuffs: bigint | null, label: string | null, message: string | null): Promise<void> {
    const trimmedAddress = address.trim()
    if (trimmedAddress.length === 0) {
      throw new Error('Address is required')
    }
    if (amountDuffs != null && amountDuffs <= 0n) {
      throw new Error('Amount must be positive')
    }
    await this.paymentRequestDAO.insertRequest(walletId, trimmedAddress, amountDuffs, label?.trim() || null, message?.trim() || null, Date.now())
  }

  async getRequests(walletId: string): Promise<PaymentRequest[]> {
    return this.paymentRequestDAO.getRequests(walletId)
  }

  async deleteRequest(walletId: string, id: number): Promise<void> {
    return this.paymentRequestDAO.deleteRequest(walletId, id)
  }
}
