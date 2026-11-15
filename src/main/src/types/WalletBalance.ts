export interface Amount {
  amount: bigint,
}

export interface WalletBalance {
  dash: Amount
  credits: Amount
}
