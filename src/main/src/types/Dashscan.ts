export interface DashscanPage<T> {
  resultSet: T[]
  pagination: {
    page: number
    limit: number
    // -1 when the result set is empty.
    total: number
  }
}

// No total: the cursor is the only position marker, and null ends the walk.
export interface DashscanCursorPage<T> {
  resultSet: T[]
  pagination: {
    limit: number
    nextCursor: string | null
  }
}

export interface DashscanVIn {
  prevTxHash: string | null
  vOutIndex: number | null
  address: string | null
  amount: string | null
  sequence: number | null
  scriptSigASM: string | null
}

export interface DashscanVOut {
  // Duffs. Documented as a string, served as a number.
  value: number | string | null
  number: number | null
  scriptPubKeyASM: string | null
  scriptPubKeyHex: string | null
  scriptPubKeyType: string | null
  address: string | null
  addresses: string[] | null
  spentTxId: string | null
  spentIndex: number | null
  spentHeight: number | null
}

export interface DashscanTransaction {
  hash: string
  type: string | null
  blockHeight: number | null
  blockHash: string | null
  timestamp: string | null
  amount: string | null
  version: number | null
  size: number | null
  vIn: DashscanVIn[] | null
  vOut: DashscanVOut[] | null
  confirmations: number | null
  instantLock: string | null
  chainLocked: boolean
  coinjoin: boolean
  multisig: boolean
}

export interface DashscanUTXO {
  prevTxHash: string | null
  vOutIndex: number | null
  address: string | null
  amount: string | null
  scriptPubKeyHex: string | null
  blockHeight: number | null
  confirmations: number | null
  timestamp?: string | null
}

// Only the field we trust. The same response carries `received` and `sent`,
// which count every change output on both sides and so overstate both.
export interface DashscanXpubSummary {
  balance: string
}

export interface DashscanXpubAddress {
  address: string
  // 0 external (receive), 1 internal (change).
  branch: number
  index: number
  used: boolean
}

export interface DashscanAddressInfo {
  address: string
  balance: string
  txCount: number
}

// /masternodes, straight from Core's `masternodelist json`. `outpoint` is the
// collateral as `txid-vout`; `lastPaidTime` is an ISO date, the epoch for never.
export interface DashscanMasternode {
  proTxHash: string
  address: string
  payee: string
  status: string
  type: string
  posPenaltyScore: number
  lastPaidTime: string
  lastPaidBlock: number
  ownerAddress: string
  votingAddress: string
  collateralAddress: string
  pubKeyOperator: string
  outpoint: string
  platformNodeId: string | null
  platformP2PPort: number | null
  platformHTTPPort: number | null
}

// /governance/proposals, every governance object Core holds, unpaged. Counts are
// funding votes, weighted; creationTime is an ISO date.
export interface DashscanProposal {
  hash: string
  objectType: string
  name: string
  url: string
  paymentAddress: string
  paymentAmount: number
  startEpoch: number
  endEpoch: number
  creationTime: string
  collateralHash: string
  yesCount: number
  noCount: number
  abstainCount: number
}
