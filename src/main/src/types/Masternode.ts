export type MasternodeKeyRole = 'voting' | 'owner' | 'operator' | 'platformNode'
// The roles a masternode list can be searched by, each walked as a key chain.
export type MasternodeKeyChain = 'owner' | 'voting' | 'operator'
export type MasternodeKeyFilter = MasternodeKeyChain | 'collateral'

// One entry of the network's masternode list. Times are unix seconds, 0 = never.
// Null is a field the source cannot give: the p2p list carries no PoSe score or
// payments, and the ProRegTx fields stay null until the registration is indexed.
export interface NetworkMasternode {
  proTxHash: string
  type: string
  status: string
  posePenaltyScore: number | null
  collateralTxid: string | null
  collateralVout: number | null
  collateralAddress: string | null
  serviceAddress: string | null
  payeeAddress: string | null
  ownerAddress: string | null
  votingAddress: string
  operatorPublicKey: string
  platformNodeId: string | null
  platformP2PPort: number | null
  platformHttpPort: number | null
  lastPaidBlock: number | null
  lastPaidTime: number | null
  // Known only to the p2p index, which read the ProRegTx at this height.
  registeredHeight: number | null
}

// A masternode this wallet holds a key or the collateral of. A null index is a
// key the seed does not derive; importedRoles are the ones held by an imported key.
export interface Masternode extends NetworkMasternode {
  ownerKeyIndex: number | null
  votingKeyIndex: number | null
  operatorKeyIndex: number | null
  importedRoles: MasternodeKeyChain[]
}

// publicKey is what the list carries for the role: the address for owner and
// voting, the hex public key for operator.
export interface ImportedMasternodeKey {
  role: MasternodeKeyChain
  publicKey: string
}

// What outlives the list: the coin a send must not spend.
export interface MasternodeCollateral {
  proTxHash: string
  txid: string
  vout: number
}

// What a wallet persists to derive its provider keys without the seed. The
// operator node is BLS, which has no xpub encoding; its public key is the
// standard compressed G1 point. Platform node keys are ed25519, indexed 0'…
export interface MasternodeKeys {
  votingXpub: string
  ownerXpub: string
  operatorPublicKey: Uint8Array
  operatorChainCode: Uint8Array
  platformNodeKeys: Uint8Array[]
}

export interface ExtendedSecretKey {
  privateKey: Uint8Array
  chainCode: Uint8Array
}
