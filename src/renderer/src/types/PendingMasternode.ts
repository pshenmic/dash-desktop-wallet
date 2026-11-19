export interface PendingMasternodeEntry {
  proTxHash: string
  type: 'Regular' | 'Evo'
  collateralTxid: string
  collateralVout: number
  collateralAddress: string | null
  serviceAddress: string | null
  payeeAddress: string
  ownerAddress: string | null
  votingAddress: string | null
  operatorPublicKey: string | null
  platformNodeId: string | null
  platformP2PPort: number | null
  platformHttpPort: number | null
  createdAt: number
}
