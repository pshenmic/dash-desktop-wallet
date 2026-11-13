export interface PaymentRequest {
  id: number
  walletId: string
  address: string
  amountDuffs: bigint | null
  label: string | null
  message: string | null
  createdAt: number
}
